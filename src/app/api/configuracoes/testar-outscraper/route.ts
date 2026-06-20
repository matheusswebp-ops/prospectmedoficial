import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json()

  if (!apiKey || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'API Key não informada.' }, { status: 400 })
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName',
      },
      body: JSON.stringify({ textQuery: 'médico São Paulo', pageSize: 1 }),
      signal: AbortSignal.timeout(8000),
    })

    if (res.status === 403 || res.status === 401) {
      return NextResponse.json({ error: 'Chave inválida ou sem permissão para Places API.' }, { status: 400 })
    }
    if (res.status === 429) {
      return NextResponse.json({ error: 'Limite de requisições atingido.' }, { status: 400 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Erro da API: ${res.status}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Não foi possível conectar à API. Verifique a chave.' }, { status: 400 })
  }
}
