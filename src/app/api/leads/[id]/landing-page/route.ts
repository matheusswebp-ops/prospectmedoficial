import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deployLpQueue } from '@/lib/queue/client'

/**
 * POST /api/leads/[id]/landing-page
 *
 * Enfileira o job de geração e deploy da landing page para um lead específico.
 * Requer autenticação e que o lead pertença ao usuário autenticado.
 *
 * Resposta de sucesso: { queued: true, jobId: string }
 * Resposta de erro:    { error: string, code: string }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // ── 1. Verificar autenticação ────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Não autenticado. Faça login para continuar.', code: 'UNAUTHENTICATED' },
      { status: 401 }
    )
  }

  const leadId = params.id

  // ── 2. Verificar que o lead existe e pertence ao usuário ─────────────────
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, nome, landing_page_status')
    .eq('id', leadId)
    .eq('user_id', user.id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json(
      { error: 'Lead não encontrado ou sem permissão de acesso.', code: 'LEAD_NOT_FOUND' },
      { status: 404 }
    )
  }

  // ── 3. Verificar se já está sendo processado ─────────────────────────────
  if (lead.landing_page_status === 'gerando') {
    return NextResponse.json(
      {
        error: 'A landing page já está sendo gerada. Aguarde a conclusão.',
        code: 'LP_ALREADY_GENERATING',
      },
      { status: 409 }
    )
  }

  // ── 4. Verificar que o usuário tem vercel_api_token configurado ──────────
  //    Usamos o cliente do servidor para buscar o perfil completo
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('vercel_api_token')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Perfil do usuário não encontrado.', code: 'PROFILE_NOT_FOUND' },
      { status: 500 }
    )
  }

  if (!profile.vercel_api_token) {
    return NextResponse.json(
      {
        error:
          'Token da Vercel não configurado. Acesse Configurações para adicionar o Vercel API Token.',
        code: 'VERCEL_TOKEN_MISSING',
      },
      { status: 400 }
    )
  }

  // ── 5. Marcar o lead como "gerando" antes de enfileirar ─────────────────
  const { error: updateError } = await supabase
    .from('leads')
    .update({ landing_page_status: 'gerando' })
    .eq('id', leadId)

  if (updateError) {
    console.error('[landing-page/route] Erro ao marcar lead como gerando:', updateError.message)
    return NextResponse.json(
      { error: 'Erro interno ao iniciar geração da landing page.', code: 'DB_UPDATE_ERROR' },
      { status: 500 }
    )
  }

  // ── 6. Enfileirar job na fila deploy-lp ─────────────────────────────────
  let job
  try {
    job = await deployLpQueue.add(
      'deploy-lp',
      { leadId, userId: user.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000, // 5s, 10s, 20s
        },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      }
    )
  } catch (queueError) {
    // Reverter o status se falhar ao enfileirar
    await supabase
      .from('leads')
      .update({ landing_page_status: 'nao_gerada' })
      .eq('id', leadId)

    console.error('[landing-page/route] Erro ao enfileirar job:', queueError)
    return NextResponse.json(
      {
        error: 'Não foi possível enfileirar o job de deploy. Verifique a conexão com o Redis.',
        code: 'QUEUE_ERROR',
      },
      { status: 503 }
    )
  }

  console.log(
    `[landing-page/route] Job enfileirado: jobId=${job.id}, leadId=${leadId}, userId=${user.id}`
  )

  return NextResponse.json(
    { queued: true, jobId: job.id },
    { status: 202 }
  )
}
