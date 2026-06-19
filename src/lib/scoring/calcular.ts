export interface LeadInput {
  temSite: boolean
  siteAcessivel: boolean
  pagespeedScore: number | null
  reviewsCount: number
}

export function calcularScore(lead: LeadInput): number {
  let score = 0

  if (!lead.temSite) {
    score += 10
  } else if (!lead.siteAcessivel) {
    score += 9
  } else if (lead.pagespeedScore !== null) {
    if (lead.pagespeedScore < 50) {
      score += 8
    } else if (lead.pagespeedScore <= 75) {
      score += 4
    }
  }

  if (lead.reviewsCount < 10) {
    score += 2
  }

  return score
}

export function deveDescartar(score: number): boolean {
  return score === 0
}
