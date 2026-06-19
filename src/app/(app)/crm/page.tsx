import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import type { KanbanStageRow, LeadRow } from '@/types/database'

export const metadata = { title: 'CRM | ProspectMed' }

export default async function CrmPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch kanban stages ordered by ordem
  const { data: stages, error: stagesError } = await supabase
    .from('kanban_stage')
    .select('*')
    .eq('user_id', user.id)
    .order('ordem', { ascending: true })

  if (stagesError) {
    console.error('[CrmPage] stages error:', stagesError)
  }

  // Fetch all leads for this user ordered by score_total DESC
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .order('score_total', { ascending: false })

  if (leadsError) {
    console.error('[CrmPage] leads error:', leadsError)
  }

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">CRM / Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie e acompanhe o progresso dos seus leads
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6">
        <KanbanBoard
          stages={(stages ?? []) as KanbanStageRow[]}
          initialLeads={(leads ?? []) as LeadRow[]}
          userId={user.id}
        />
      </div>
    </div>
  )
}
