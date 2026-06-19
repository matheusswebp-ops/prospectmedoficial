// Google Places API (New) — substitui Outscraper com dados do próprio Google Maps
export interface OutscraperPlace {
  name: string
  place_id: string
  phone: string
  full_address: string
  city: string
  site: string
  photo: string
  reviews: number
  rating: number
  type: string[]
}

interface PlacesSearchResponse {
  places?: GooglePlace[]
  nextPageToken?: string
}

interface GooglePlace {
  id?: string
  displayName?: { text?: string }
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  formattedAddress?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  types?: string[]
  photos?: { name?: string }[]
}

async function fetchPhotoUrl(photoName: string, apiKey: string): Promise<string> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${apiKey}&skipHttpRedirect=true`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return ''
    const json = await res.json() as { photoUri?: string }
    return json.photoUri ?? ''
  } catch {
    return ''
  }
}

export async function searchPlaces(
  especialidade: string,
  cidade: string,
  apiKey: string,
  limit = 40
): Promise<OutscraperPlace[]> {
  const query = `${especialidade} em ${cidade}, Brasil`
  const results: OutscraperPlace[] = []
  let nextPageToken: string | undefined

  while (results.length < limit) {
    const body: Record<string, unknown> = {
      textQuery: query,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      maxResultCount: Math.min(20, limit - results.length),
    }
    if (nextPageToken) body.pageToken = nextPageToken

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.types,places.photos,nextPageToken',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (response.status === 401 || response.status === 403) throw new Error('PLACES_INVALID_KEY')
    if (response.status === 429) throw new Error('PLACES_RATE_LIMIT')
    if (!response.ok) throw new Error(`PLACES_ERROR_${response.status}`)

    const json = await response.json() as PlacesSearchResponse
    const places = json.places ?? []
    if (places.length === 0) break

    for (const place of places) {
      const photoName = place.photos?.[0]?.name ?? ''
      const photo = photoName ? await fetchPhotoUrl(photoName, apiKey) : ''

      results.push({
        name: place.displayName?.text ?? '',
        place_id: place.id ?? '',
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? '',
        full_address: place.formattedAddress ?? '',
        city: cidade,
        site: place.websiteUri ?? '',
        photo,
        reviews: place.userRatingCount ?? 0,
        rating: place.rating ?? 0,
        type: place.types ?? [],
      })
    }

    nextPageToken = json.nextPageToken
    if (!nextPageToken) break
  }

  return results
}
