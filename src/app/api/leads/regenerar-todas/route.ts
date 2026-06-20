import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deployLpQueue } from '@/lib/queue/client'

/**
 * POST /api/leads/regenerar-todas
 *
 * Enfileira o job de (re)geração de landing page para TODOS os leads do usuário.
 * Útil para aplicar atualizações de template sem precisar criar novos leads.
 */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Não autenticado.', code: 'UNAUTHENTICATED' },
      { status: 401 }
    )
  }

  // Verificar token Vercel
  const { data: profile } = await supabase
    .from('users')
    .select('vercel_api_token')
    .eq('id', user.id)
    .single()

  if (!profile?.vercel_api_token) {
    return NextResponse.json(
      { error: 'Token da Vercel não configurado.', code: 'VERCEL_TOKEN_MISSING' },
      { status: 400 }
    )
  }

  // Buscar todos os leads do usuário
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id')
    .eq('user_id', user.id)
    .neq('landing_page_status', 'gerando')

  if (leadsError) {
    return NextResponse.json(
      { error: 'Erro ao buscar leads.', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ queued: 0 })
  }

  // Marcar todos como 'gerando'
  await supabase
    .from('leads')
    .update({ landing_page_status: 'gerando' })
    .eq('user_id', user.id)
    .neq('landing_page_status', 'gerando')

  // Enfileirar um job por lead com delay escalonado para não sobrecarregar a Vercel
  let queued = 0
  for (let i = 0; i < leads.length; i++) {
    try {
      await deployLpQueue.add(
        'deploy-lp',
        { leadId: leads[i].id, userId: user.id },
        {
          attempts: 3,
          delay: i * 8000, // 8s entre cada deploy para respeitar rate limit da Vercel
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 100 },
        }
      )
      queued++
    } catch (err) {
      console.error(`[regenerar-todas] Erro ao enfileirar lead ${leads[i].id}:`, err)
    }
  }

  console.log(`[regenerar-todas] ${queued}/${leads.length} jobs enfileirados para userId=${user.id}`)

  return NextResponse.json({ queued }, { status: 202 })
}
