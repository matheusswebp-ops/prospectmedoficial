import { Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { avaliarSite } from '../src/lib/pagespeed/client'
import { calcularScore } from '../src/lib/scoring/calcular'

export interface PagespeedJobData {
  leadId: string
  siteUrl: string
  userId: string
}

export async function processJob(job: Job<PagespeedJobData>): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { leadId, siteUrl } = job.data

  // 1. Avaliar o site via PageSpeed
  const avaliacao = await avaliarSite(siteUrl)

  // 2. Atualizar pagespeed_score e classificacao no lead
  const { data: updatedLead, error: updateError } = await supabase
    .from('leads')
    .update({
      pagespeed_score: avaliacao.score,
      pagespeed_classificacao: avaliacao.classificacao,
    })
    .eq('id', leadId)
    .select('reviews_count, website_url')
    .single()

  if (updateError) {
    console.error(`[pagespeed] Falha ao atualizar lead ${leadId}:`, updateError.message)
    throw updateError
  }

  // 3. Recalcular score_total com o novo pagespeed_score
  const reviewsCount = (updatedLead as { reviews_count?: number })?.reviews_count ?? 0
  const temSite = !!(updatedLead as { website_url?: string })?.website_url
  const siteAcessivel =
    avaliacao.score !== null &&
    avaliacao.score > 0 &&
    avaliacao.classificacao !== 'sem_site'

  const novoScore = calcularScore({
    temSite,
    siteAcessivel,
    pagespeedScore: avaliacao.score,
    reviewsCount,
  })

  // 4. Persistir score_total recalculado
  const { error: scoreError } = await supabase
    .from('leads')
    .update({ score_total: novoScore })
    .eq('id', leadId)

  if (scoreError) {
    console.error(`[pagespeed] Falha ao atualizar score do lead ${leadId}:`, scoreError.message)
    throw scoreError
  }

  console.log(
    `[pagespeed] Lead ${leadId}: score=${avaliacao.score}, classificacao=${avaliacao.classificacao}, score_total=${novoScore}`
  )
}
