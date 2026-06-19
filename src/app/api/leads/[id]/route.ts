import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  especialidade: z.string().min(1).optional(),
  cidade: z.string().min(1).optional(),
  telefone: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  website_url: z.string().url().nullable().optional(),
  foto_url: z.string().url().nullable().optional(),
  status_kanban: z.string().min(1).optional(),
  status: z.enum(['novo', 'em_crm', 'descartado', 'ja_cliente', 'expirado', 'duplicata_suspeita', 'dado_invalido']).optional(),
})

// ── GET /api/leads/[id] ────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Fetch lead — RLS ensures user_id = auth.uid()
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead não encontrado', code: 'LEAD_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Fetch kanban activity (chronological)
    const { data: activities } = await supabase
      .from('kanban_activity')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true })

    // Fetch notes (chronological)
    const { data: notes } = await supabase
      .from('lead_note')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      lead,
      activities: activities ?? [],
      notes: notes ?? [],
    })
  } catch (err) {
    console.error('[GET /api/leads/[id]]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// ── PATCH /api/leads/[id] ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id } = await params

    const body = await request.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('[PATCH /api/leads/[id]]', updateError)
      return NextResponse.json(
        { error: 'Lead não encontrado ou erro ao atualizar', code: 'UPDATE_ERROR' },
        { status: updateError?.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({ lead: updated })
  } catch (err) {
    console.error('[PATCH /api/leads/[id]]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
