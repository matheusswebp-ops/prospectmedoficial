import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prospeccaoQueue } from '@/lib/queue/client'

const bodySchema = z.object({
  cidade: z.string().min(2, 'Cidade deve ter ao menos 2 caracteres'),
  especialidade: z.string().min(2, 'Especialidade deve ter ao menos 2 caracteres'),
})

export async function POST(request: NextRequest) {
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

    // 2. Validar body
    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    const { cidade, especialidade } = parsed.data

    // 3. Buscar usuário — checar limite diário e chave Outscraper
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('leads_hoje, outscraper_api_key')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Usuário não encontrado', code: 'USER_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (userData.leads_hoje >= 12) {
      return NextResponse.json(
        { error: 'Limite diário de 12 leads atingido. Tente novamente amanhã.', code: 'LIMITE_DIARIO_ATINGIDO' },
        { status: 429 }
      )
    }

    if (!userData.outscraper_api_key) {
      return NextResponse.json(
        { error: 'Chave da API Outscraper não configurada. Acesse Configurações para adicioná-la.', code: 'OUTSCRAPER_KEY_MISSING' },
        { status: 400 }
      )
    }

    // 5. Criar batch com status idle
    const { data: batch, error: batchError } = await supabase
      .from('prospeccao_batch')
      .insert({
        user_id: user.id,
        cidade,
        especialidade,
        status: 'idle',
      })
      .select('id')
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Erro ao criar batch de prospecção', code: 'BATCH_CREATE_ERROR' },
        { status: 500 }
      )
    }

    // 6. Enfileirar job BullMQ
    const job = await prospeccaoQueue.add(
      'prospectar',
      {
        batchId: batch.id,
        userId: user.id,
        cidade,
        especialidade,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    )

    // 7. Salvar job_id no batch
    await supabase
      .from('prospeccao_batch')
      .update({ job_id: job.id })
      .eq('id', batch.id)

    // 8. Retornar batchId
    return NextResponse.json({ batchId: batch.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/prospeccao/iniciar]', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
