import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar Authorization header com CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET

    if (!expectedToken) {
      console.error('[CRON] CRON_SECRET não configurado')
      return NextResponse.json(
        { error: 'Configuração de cron ausente', code: 'CRON_NOT_CONFIGURED' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Não autorizado', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 2. Usar service role para bypassar RLS e atualizar todos os usuários
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('users')
      .update({
        leads_hoje: 0,
        leads_reset_at: new Date().toISOString().split('T')[0], // CURRENT_DATE
      })
      .lt('leads_reset_at', new Date().toISOString().split('T')[0])
      .select('id')

    if (error) {
      console.error('[CRON] Erro ao resetar leads:', error)
      return NextResponse.json(
        { error: 'Erro ao executar reset', code: 'RESET_ERROR' },
        { status: 500 }
      )
    }

    const count = data?.length ?? 0
    console.log(`[CRON] Reset diário executado: ${count} usuário(s) resetado(s)`)

    return NextResponse.json({ reset: count })
  } catch (err) {
    console.error('[POST /api/cron/reset-leads-diario]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
