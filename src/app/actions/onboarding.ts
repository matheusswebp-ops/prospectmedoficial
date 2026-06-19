'use server'

import { createServiceClient } from '@/lib/supabase/server'

const DEFAULT_KANBAN_STAGES = [
  { nome: 'Novo',          cor: '#6B7280', ordem: 1, is_default: true  },
  { nome: 'Site no ar',    cor: '#3B82F6', ordem: 2, is_default: false },
  { nome: 'Abordado',      cor: '#F59E0B', ordem: 3, is_default: false },
  { nome: 'Respondeu',     cor: '#8B5CF6', ordem: 4, is_default: false },
  { nome: 'Em negociação', cor: '#EC4899', ordem: 5, is_default: false },
  { nome: 'Fechado',       cor: '#10B981', ordem: 6, is_default: false },
  { nome: 'Sem interesse', cor: '#EF4444', ordem: 7, is_default: false },
] as const

export async function createDefaultKanbanStages(userId: string) {
  const supabase = createServiceClient()

  const stages = DEFAULT_KANBAN_STAGES.map((stage) => ({
    ...stage,
    user_id: userId,
  }))

  const { error } = await supabase
    .from('kanban_stage')
    .insert(stages)

  if (error) {
    console.error('[onboarding] Erro ao criar estágios Kanban:', error.message)
    throw new Error('Não foi possível criar os estágios do Kanban.')
  }
}
