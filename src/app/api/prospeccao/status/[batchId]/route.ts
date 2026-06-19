import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PROGRESSO_MAP: Record<string, number> = {
  idle: 0,
  running: 15,
  filtering: 35,
  scoring: 55,
  delivering: 75,
  completed: 100,
  partial: 100,
  failed: 0,
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
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

    const { batchId } = await params

    // 2. Buscar batch — RLS garante que só retorna se pertencer ao usuário
    const { data: batch, error: batchError } = await supabase
      .from('prospeccao_batch')
      .select(
        'id, status, total_encontrados, total_novos, total_duplicados, erro_mensagem, completed_at, cidade, especialidade, created_at'
      )
      .eq('id', batchId)
      .eq('user_id', user.id)
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Batch não encontrado', code: 'BATCH_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 4. Calcular progresso
    const progresso = PROGRESSO_MAP[batch.status] ?? 0

    return NextResponse.json({
      ...batch,
      progresso,
    })
  } catch (err) {
    console.error('[GET /api/prospeccao/status/[batchId]]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
