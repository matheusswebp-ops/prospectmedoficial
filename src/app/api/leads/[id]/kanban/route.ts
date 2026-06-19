import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  estagio: z.string().min(1, 'Estágio é obrigatório'),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    // 2. Validar body
    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    const { estagio } = parsed.data

    // 3. Buscar lead atual para capturar estágio anterior (RLS garante que é do usuário)
    const { data: leadAtual, error: fetchError } = await supabase
      .from('leads')
      .select('id, status_kanban, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !leadAtual) {
      return NextResponse.json(
        { error: 'Lead não encontrado', code: 'LEAD_NOT_FOUND' },
        { status: 404 }
      )
    }

    const estagioAnterior = leadAtual.status_kanban

    // Sem mudança — retornar lead sem operações desnecessárias
    if (estagioAnterior === estagio) {
      const { data: leadSemMudanca } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single()
      return NextResponse.json({ lead: leadSemMudanca })
    }

    // 4. Atualizar status_kanban do lead
    const { data: leadAtualizado, error: updateError } = await supabase
      .from('leads')
      .update({ status_kanban: estagio })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError || !leadAtualizado) {
      console.error('[PATCH /api/leads/[id]/kanban] update error:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar lead', code: 'UPDATE_ERROR' },
        { status: 500 }
      )
    }

    // 5. Registrar movimentação em kanban_activity (append-only)
    const { error: activityError } = await supabase
      .from('kanban_activity')
      .insert({
        lead_id: id,
        user_id: user.id,
        estagio_anterior: estagioAnterior,
        estagio_novo: estagio,
      })

    if (activityError) {
      // Log mas não falha a request — a atualização do lead já ocorreu
      console.error('[PATCH /api/leads/[id]/kanban] activity insert error:', activityError)
    }

    return NextResponse.json({ lead: leadAtualizado })
  } catch (err) {
    console.error('[PATCH /api/leads/[id]/kanban]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
