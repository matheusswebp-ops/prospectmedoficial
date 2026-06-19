import { Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { searchPlaces, OutscraperPlace } from '../src/lib/outscraper/client'
import { normalizarTelefone, gerarSlug, isDomainBlacklisted, isDuplicado } from '../src/lib/dedup/checar'
import { avaliarSite } from '../src/lib/pagespeed/client'
import { calcularScore, deveDescartar } from '../src/lib/scoring/calcular'

export interface ProspectarJobData {
  batchId: string
  userId: string
  cidade: string
  especialidade: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function classificarPagespeed(score: number | null): 'sem_site' | 'site_ruim' | 'site_medio' | 'site_bom' {
  if (score === null) return 'site_ruim'
  if (score > 75) return 'site_bom'
  if (score >= 50) return 'site_medio'
  return 'site_ruim'
}

export async function processJob(job: Job<ProspectarJobData>): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { batchId, userId, cidade, especialidade } = job.data

  // 1. Marcar batch como running
  await supabase
    .from('prospeccao_batch')
    .update({ status: 'running' })
    .eq('id', batchId)

  try {
    // 2. Buscar outscraper_api_key do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('outscraper_api_key')
      .eq('id', userId)
      .single()

    if (userError || !userData?.outscraper_api_key) {
      throw new Error('OUTSCRAPER_KEY_NOT_FOUND')
    }

    const outscraperApiKey = userData.outscraper_api_key as string

    // 3. Chamar Outscraper
    const results: OutscraperPlace[] = await searchPlaces(
      especialidade,
      cidade,
      outscraperApiKey,
      40
    )

    // 4. Atualizar batch com total encontrado e mudar para filtering
    await supabase
      .from('prospeccao_batch')
      .update({
        total_encontrados: results.length,
        status: 'filtering',
      })
      .eq('id', batchId)

    // 5. Processar cada resultado: normalizar, dedup, blacklist
    interface Candidate {
      place: OutscraperPlace
      telefoneE164: string | null
      nomeSlug: string
    }

    const candidates: Candidate[] = []

    for (const place of results) {
      const telefoneE164 = normalizarTelefone(place.phone)
      const nomeSlug = gerarSlug(place.name)

      // Checar blacklist de domínio
      const siteUrl = place.site && place.site !== 'None' && place.site !== 'undefined' ? place.site : null
      if (siteUrl && isDomainBlacklisted(siteUrl)) {
        continue
      }

      // Checar deduplicação
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duplicado = await isDuplicado(
        supabase as any,
        userId,
        place.place_id || null,
        telefoneE164,
        nomeSlug
      )

      if (duplicado) continue

      candidates.push({ place, telefoneE164, nomeSlug })
    }

    // 6. Mudar para scoring
    await supabase
      .from('prospeccao_batch')
      .update({ status: 'scoring' })
      .eq('id', batchId)

    // 7. Avaliar PageSpeed para candidatos com site (com delay de 3000ms entre chamadas)
    interface ScoredCandidate extends Candidate {
      pagespeedScore: number | null
      classificacao: 'sem_site' | 'site_ruim' | 'site_medio' | 'site_bom'
      siteAcessivel: boolean
      scoreTotal: number
      fotoUrl: string | null
    }

    const scoredCandidates: ScoredCandidate[] = []
    let firstPagespeedCall = true

    for (const candidate of candidates) {
      const { place, telefoneE164, nomeSlug } = candidate
      const siteUrl =
        place.site && place.site !== 'None' && place.site !== 'undefined'
          ? place.site
          : null

      let pagespeedScore: number | null = null
      let classificacao: 'sem_site' | 'site_ruim' | 'site_medio' | 'site_bom' = 'sem_site'
      let siteAcessivel = false
      let fotoUrl: string | null = place.photo && place.photo !== 'None' ? place.photo : null

      if (siteUrl) {
        // Delay obrigatório entre chamadas PageSpeed (não antes da primeira)
        if (!firstPagespeedCall) {
          await sleep(3000)
        }
        firstPagespeedCall = false

        const avaliacao = await avaliarSite(siteUrl)
        pagespeedScore = avaliacao.score
        classificacao = avaliacao.classificacao
        siteAcessivel = pagespeedScore !== null && pagespeedScore > 0
        if (avaliacao.fotoUrl) fotoUrl = avaliacao.fotoUrl
      }

      // 8. Calcular score total
      const scoreTotal = calcularScore({
        temSite: !!siteUrl,
        siteAcessivel,
        pagespeedScore,
        reviewsCount: place.reviews ?? 0,
      })

      scoredCandidates.push({
        place,
        telefoneE164,
        nomeSlug,
        pagespeedScore,
        classificacao,
        siteAcessivel,
        scoreTotal,
        fotoUrl,
      })
    }

    // 9. Descartar leads com score = 0 (site_bom — nenhuma oportunidade de melhoria)
    const qualified = scoredCandidates.filter((c) => !deveDescartar(c.scoreTotal))

    // 10. Ordenar por score DESC e pegar top 12
    const top12 = qualified.sort((a, b) => b.scoreTotal - a.scoreTotal).slice(0, 12)

    // 11. Mudar para delivering
    await supabase
      .from('prospeccao_batch')
      .update({ status: 'delivering' })
      .eq('id', batchId)

    // 12. Inserir leads no banco
    let totalInseridos = 0
    const totalDuplicados = results.length - candidates.length

    for (const candidate of top12) {
      const { place, telefoneE164, nomeSlug, pagespeedScore, classificacao, scoreTotal, fotoUrl } = candidate

      const siteUrl =
        place.site && place.site !== 'None' && place.site !== 'undefined'
          ? place.site
          : null

      const { error: insertError } = await supabase
        .from('leads')
        .upsert(
          {
            user_id: userId,
            batch_id: batchId,
            nome: place.name,
            nome_slug: nomeSlug,
            especialidade,
            telefone: place.phone || null,
            telefone_e164: telefoneE164,
            cidade: place.city || cidade,
            endereco: place.full_address || null,
            website_url: siteUrl,
            google_maps_place_id: place.place_id || null,
            pagespeed_score: pagespeedScore,
            pagespeed_classificacao: classificacao,
            score_total: scoreTotal,
            foto_url: fotoUrl,
            status_kanban: 'Novo',
          },
          {
            onConflict: 'google_maps_place_id,user_id',
            ignoreDuplicates: true,
          }
        )

      if (!insertError) {
        totalInseridos++
      } else {
        console.warn(`[prospectar] Insert falhou para ${place.name}:`, insertError.message)
      }
    }

    // 13. Incrementar leads_hoje no usuário
    if (totalInseridos > 0) {
      await supabase.rpc('increment_leads_hoje', {
        p_user_id: userId,
        p_incremento: totalInseridos,
      })
    }

    // 14. Atualizar batch como completed
    const finalStatus = totalInseridos >= 6 ? 'completed' : totalInseridos > 0 ? 'partial' : 'failed'

    await supabase
      .from('prospeccao_batch')
      .update({
        status: finalStatus,
        total_novos: totalInseridos,
        total_duplicados: totalDuplicados,
        completed_at: new Date().toISOString(),
        erro_mensagem:
          finalStatus === 'failed'
            ? `Apenas ${totalInseridos} leads qualificados encontrados (mínimo: 6)`
            : null,
      })
      .eq('id', batchId)

    console.log(
      `[prospectar] Batch ${batchId} concluído: ${totalInseridos} inseridos, ${totalDuplicados} duplicados, status=${finalStatus}`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[prospectar] Batch ${batchId} falhou:`, message)

    await supabase
      .from('prospeccao_batch')
      .update({
        status: 'failed',
        erro_mensagem: message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    throw error // re-throw para BullMQ registrar como falha
  }
}
