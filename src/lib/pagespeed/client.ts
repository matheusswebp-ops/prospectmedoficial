export interface PageSpeedResult {
  score: number | null
  classificacao: 'sem_site' | 'site_ruim' | 'site_medio' | 'site_bom'
  fotoUrl: string | null
}

const FALLBACK: PageSpeedResult = { score: 0, classificacao: 'site_ruim', fotoUrl: null }

export async function avaliarSite(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  if (!apiKey) return FALLBACK

  try {
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}`

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return FALLBACK

    const json = await response.json() as Record<string, unknown>

    const lighthouse = json?.lighthouseResult as Record<string, unknown> | undefined
    const categories = lighthouse?.categories as Record<string, unknown> | undefined
    const performance = categories?.performance as Record<string, unknown> | undefined
    const rawScore: number | undefined = performance?.score as number | undefined

    if (rawScore === undefined || rawScore === null) return FALLBACK

    const score = Math.round(rawScore * 100)

    let classificacao: PageSpeedResult['classificacao']
    if (score > 75) {
      classificacao = 'site_bom'
    } else if (score >= 50) {
      classificacao = 'site_medio'
    } else {
      classificacao = 'site_ruim'
    }

    return { score, classificacao, fotoUrl: null }
  } catch {
    return FALLBACK
  }
}
