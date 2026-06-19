import { createClient } from '@supabase/supabase-js'

export function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 11) return null
  return '55' + digits
}

export function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(dr|dra|prof)\.?\s+/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

const DOMAIN_BLACKLIST = [
  'instagram.com',
  'facebook.com',
  'linktr.ee',
  'doctoralia.com.br',
  'boaconsulta.com',
  'wa.me',
  'whatsapp.com',
  'twitter.com',
]

export function isDomainBlacklisted(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`)
    return DOMAIN_BLACKLIST.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))
  } catch {
    return false
  }
}

export async function isDuplicado(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  placeId: string | null,
  telefoneE164: string | null,
  _nomeSlug: string // reserved for future fuzzy dedup via pg_trgm
): Promise<boolean> {
  if (placeId) {
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('google_maps_place_id', placeId)
      .eq('user_id', userId)
      .limit(1)

    if (data && data.length > 0) return true
  }

  if (telefoneE164) {
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('telefone_e164', telefoneE164)
      .eq('user_id', userId)
      .limit(1)

    if (data && data.length > 0) return true
  }

  return false
}
