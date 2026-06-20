import { Job } from 'bullmq'
import { createWorkerSupabase } from './supabase'
import { gerarHtml } from '../src/lib/vercel-deploy/gerar-html'
import { deployLandingPage } from '../src/lib/vercel-deploy/client'

export interface DeployLpJobData {
  leadId: string
  userId: string
}

/**
 * Gera o slug do lead para uso como nome do deployment na Vercel.
 * Inclui sufixo de timestamp base-36 para evitar colisões.
 */
function gerarSlugDeployment(nome: string, cidade: string): string {
  const slugNome = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(dr|dra|prof)\.?\s+/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 30)

  const slugCidade = cidade
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 15)

  const suffix = Date.now().toString(36)

  return `${slugNome}-${slugCidade}-${suffix}`.substring(0, 100)
}

/**
 * Gera um avatar SVG com as iniciais do nome e a cor primária da especialidade.
 * Retorna uma data URI base64 pronta para usar no HTML.
 */
function gerarAvatarSvg(nome: string, corPrimaria: string): string {
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${corPrimaria};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${corPrimaria}cc;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#grad)"/>
      <text
        x="200"
        y="240"
        font-family="Arial, sans-serif"
        font-size="140"
        font-weight="bold"
        fill="white"
        fill-opacity="0.92"
        text-anchor="middle"
        dominant-baseline="middle"
      >${iniciais}</text>
    </svg>
  `.trim()

  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Extrai a cor primária da especialidade do JSON de cores.
 * Carregado dinamicamente para evitar dependência circular em runtime.
 */
function getCorPrimaria(especialidade: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const colors = require('../src/lib/specialty-colors.json') as Record<
      string,
      { primaria: string; secundaria: string }
    >
    const lower = especialidade.toLowerCase()

    if (/dentist|odontolog|cirurgião.dentista|dent/.test(lower)) return colors.odontologia.primaria
    if (/cardio/.test(lower)) return colors.cardiologia.primaria
    if (/pediatr|infant/.test(lower)) return colors.pediatria.primaria
    if (/dermat/.test(lower)) return colors.dermatologia.primaria
    if (/psicolog|psiquiatr/.test(lower)) return colors.psicologia.primaria
    if (/nutri/.test(lower)) return colors.nutricao.primaria
    if (/fisio/.test(lower)) return colors.fisioterapia.primaria
    if (/oftalm/.test(lower)) return colors.oftalmologia.primaria
    if (/ortop/.test(lower)) return colors.ortopedia.primaria
    if (/neurol/.test(lower)) return colors.neurologia.primaria
    if (/endocrin/.test(lower)) return colors.endocrinologia.primaria
    if (/ginecol|obstetri/.test(lower)) return colors.ginecologia.primaria
    if (/urol/.test(lower)) return colors.urologia.primaria
    if (/gastro/.test(lower)) return colors.gastroenterologia.primaria
    if (/reumat/.test(lower)) return colors.reumatologia.primaria

    return colors.default.primaria
  } catch {
    return '#2C3E50' // fallback hardcoded
  }
}

export async function processJob(job: Job<DeployLpJobData>): Promise<void> {
  const { leadId, userId } = job.data

  const supabase = createWorkerSupabase()

  console.log(`[deploy-lp] Iniciando deploy para leadId=${leadId}, userId=${userId}`)

  // ── 1. Buscar lead e user ────────────────────────────────────────────────
  const [{ data: lead, error: leadError }, { data: user, error: userError }] = await Promise.all([
    supabase
      .from('leads')
      .select(
        'id, nome, especialidade, cidade, telefone, telefone_e164, foto_url, endereco, landing_page_status'
      )
      .eq('id', leadId)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('users')
      .select('vercel_api_token, vercel_team_id')
      .eq('id', userId)
      .single(),
  ])

  if (leadError || !lead) {
    throw new Error(`Lead não encontrado: ${leadError?.message ?? 'sem dados'}`)
  }

  if (userError || !user) {
    throw new Error(`Usuário não encontrado: ${userError?.message ?? 'sem dados'}`)
  }

  if (!user.vercel_api_token) {
    // Marcar como erro e encerrar sem lançar exceção (não vale retry)
    await supabase
      .from('leads')
      .update({ landing_page_status: 'erro' })
      .eq('id', leadId)
    console.error(`[deploy-lp] vercel_api_token não configurado para userId=${userId}`)
    return
  }

  // ── 2. Marcar como "gerando" ─────────────────────────────────────────────
  await supabase
    .from('leads')
    .update({ landing_page_status: 'gerando' })
    .eq('id', leadId)

  try {
    // ── 3. Gerar slug único ────────────────────────────────────────────────
    const slug = gerarSlugDeployment(lead.nome, lead.cidade)

    // ── 4. Resolver foto ───────────────────────────────────────────────────
    //    Usar foto_url do lead se existir, caso contrário gerar avatar SVG
    let fotoResolvida = lead.foto_url

    if (!fotoResolvida || fotoResolvida.trim() === '') {
      const corPrimaria = getCorPrimaria(lead.especialidade)
      fotoResolvida = gerarAvatarSvg(lead.nome, corPrimaria)
      console.log(`[deploy-lp] Usando avatar SVG para leadId=${leadId}`)
    }

    // ── 5. Gerar HTML com a foto já resolvida ──────────────────────────────
    const htmlComFoto = gerarHtml({
      nome: lead.nome,
      especialidade: lead.especialidade,
      cidade: lead.cidade,
      telefone_e164: lead.telefone_e164,
      telefone: lead.telefone,
      foto_url: fotoResolvida,
      endereco: lead.endereco,
    })

    // ── 6. Deploy na Vercel ────────────────────────────────────────────────
    console.log(`[deploy-lp] Fazendo deploy para slug="${slug}"`)
    const result = await deployLandingPage(
      htmlComFoto,
      slug,
      user.vercel_api_token,
      user.vercel_team_id ?? undefined
    )

    console.log(
      `[deploy-lp] Deploy concluído: id=${result.deploymentId}, url=${result.url}, status=${result.status}`
    )

    // ── 7. Salvar resultado no banco ───────────────────────────────────────
    const landingStatus = result.status === 'ERROR' ? 'erro' : 'publicada'

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        landing_page_url: result.url,
        landing_page_vercel_id: result.deploymentId,
        landing_page_status: landingStatus,
      })
      .eq('id', leadId)

    if (updateError) {
      console.error(`[deploy-lp] Erro ao salvar URL no banco: ${updateError.message}`)
      throw new Error(`Falha ao atualizar lead após deploy: ${updateError.message}`)
    }

    console.log(`[deploy-lp] Lead ${leadId} atualizado com landing_page_status="${landingStatus}"`)
  } catch (err) {
    // ── Tratamento de erro: marcar LP como erro ────────────────────────────
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[deploy-lp] Erro no pipeline de deploy para leadId=${leadId}: ${errorMessage}`)

    await supabase
      .from('leads')
      .update({ landing_page_status: 'erro' })
      .eq('id', leadId)

    // Relançar para o BullMQ registrar a falha no job
    throw err
  }
}
