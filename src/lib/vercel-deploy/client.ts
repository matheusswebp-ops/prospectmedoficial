/**
 * Cliente para o Vercel Deployments API.
 * Faz deploy de um arquivo HTML estático como site de produção via Vercel API v13.
 *
 * Documentação: https://vercel.com/docs/rest-api/endpoints/deployments#create-a-new-deployment
 */

export interface VercelDeployResult {
  deploymentId: string
  url: string
  status: 'READY' | 'ERROR' | 'BUILDING'
}

interface VercelDeploymentResponse {
  id: string
  url?: string
  alias?: string[]
  readyState?: string
  status?: string
  error?: {
    code: string
    message: string
  }
}

/**
 * Faz deploy de um HTML estático via Vercel Deployments API.
 *
 * @param html        - Conteúdo HTML completo pronto para deploy
 * @param slug        - Nome do deployment (usado como nome do projeto na Vercel)
 * @param vercelToken - Personal Access Token da Vercel do usuário
 * @param teamId      - Team ID da Vercel (opcional — null para conta pessoal)
 * @returns           - Dados do deployment criado
 *
 * @throws {Error} Em caso de falha na API ou timeout
 */
export async function deployLandingPage(
  html: string,
  slug: string,
  vercelToken: string,
  teamId?: string | null
): Promise<VercelDeployResult> {
  // Sanitizar o slug: apenas lowercase, alfanumérico e hífens, max 100 chars
  const sanitizedSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)

  // Construir URL da API — adicionar teamId como query param se fornecido
  const baseUrl = 'https://api.vercel.com/v13/deployments'
  const url = teamId ? `${baseUrl}?teamId=${encodeURIComponent(teamId)}` : baseUrl

  // Codificar o HTML em base64
  const htmlBase64 = Buffer.from(html, 'utf-8').toString('base64')

  const payload = {
    name: sanitizedSlug,
    files: [
      {
        file: 'index.html',
        data: htmlBase64,
        encoding: 'base64',
      },
    ],
    projectSettings: {
      framework: null,
    },
    target: 'production',
    // Header X-Robots-Tag: noindex em todas as rotas (compliance LGPD)
    headers: [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
      },
    ],
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000), // 60s timeout
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('VERCEL_DEPLOY_TIMEOUT: Deploy excedeu 60 segundos')
    }
    throw new Error(`VERCEL_DEPLOY_NETWORK_ERROR: ${err instanceof Error ? err.message : String(err)}`)
  }

  let data: VercelDeploymentResponse
  try {
    data = await response.json()
  } catch {
    throw new Error(`VERCEL_DEPLOY_INVALID_RESPONSE: Status HTTP ${response.status}`)
  }

  // Tratar erros de API
  if (!response.ok) {
    const errorCode = data.error?.code ?? 'UNKNOWN'
    const errorMsg = data.error?.message ?? `HTTP ${response.status}`

    if (response.status === 401) {
      throw new Error(`VERCEL_DEPLOY_UNAUTHORIZED: Token inválido ou expirado. ${errorMsg}`)
    }
    if (response.status === 402) {
      throw new Error(`VERCEL_DEPLOY_PAYMENT_REQUIRED: Limite do plano atingido. ${errorMsg}`)
    }
    if (response.status === 429) {
      throw new Error(`VERCEL_DEPLOY_RATE_LIMIT: Rate limit de deploys atingido. ${errorMsg}`)
    }

    throw new Error(`VERCEL_DEPLOY_API_ERROR [${errorCode}]: ${errorMsg}`)
  }

  if (!data.id) {
    throw new Error('VERCEL_DEPLOY_MISSING_ID: Resposta da API não contém deployment ID')
  }

  // Extrair URL pública — pode vir em .url ou .alias[0]
  const deployUrl =
    data.url
      ? `https://${data.url}`
      : data.alias?.[0]
        ? `https://${data.alias[0]}`
        : `https://${sanitizedSlug}.vercel.app`

  // Mapear readyState para o tipo de status esperado
  const rawState = (data.readyState ?? data.status ?? 'BUILDING').toUpperCase()
  let status: VercelDeployResult['status'] = 'BUILDING'
  if (rawState === 'READY') status = 'READY'
  else if (rawState === 'ERROR') status = 'ERROR'

  return {
    deploymentId: data.id,
    url: deployUrl,
    status,
  }
}
