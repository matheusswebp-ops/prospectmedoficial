import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { apiToken } = await req.json()

  if (!apiToken || typeof apiToken !== 'string') {
    return NextResponse.json({ error: 'Token não informado.' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(8000),
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: 'Token inválido ou sem permissão.' }, { status: 400 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Erro da API Vercel: ${res.status}` }, { status: 400 })
    }

    const data = await res.json()
    const username = data.user?.username || data.user?.name || 'Conta verificada'
    return NextResponse.json({ ok: true, username })
  } catch {
    return NextResponse.json({ error: 'Não foi possível conectar à Vercel.' }, { status: 400 })
  }
}
