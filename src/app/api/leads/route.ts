import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 2. Extrair filtros opcionais da query string
    const { searchParams } = request.nextUrl
    const status_kanban = searchParams.get('status_kanban')
    const especialidade = searchParams.get('especialidade')
    const cidade = searchParams.get('cidade')

    // 3. Montar query com filtros opcionais — RLS garante isolamento por user_id
    let query = supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status_kanban) {
      query = query.eq('status_kanban', status_kanban)
    }

    if (especialidade) {
      query = query.eq('especialidade', especialidade)
    }

    if (cidade) {
      query = query.eq('cidade', cidade)
    }

    const { data: leads, error: leadsError } = await query

    if (leadsError) {
      console.error('[GET /api/leads]', leadsError)
      return NextResponse.json(
        { error: 'Erro ao buscar leads', code: 'FETCH_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({ leads: leads ?? [] })
  } catch (err) {
    console.error('[GET /api/leads]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
