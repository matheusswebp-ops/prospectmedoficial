'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './LeadCard'
import type { KanbanStageRow, LeadRow } from '@/types/database'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  stage: KanbanStageRow
  leads: LeadRow[]
  onLeadUpdate?: (lead: LeadRow) => void
}

export function KanbanColumn({ stage, leads, onLeadUpdate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.nome })

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2 rounded-lg bg-card border border-border shadow-card">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.cor }}
          />
          <h2 className="text-sm font-semibold text-foreground truncate">{stage.nome}</h2>
        </div>
        <span className="ml-2 shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
          {leads.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 flex flex-col gap-2 rounded-lg p-2 transition-colors duration-150 overflow-y-auto min-h-[120px]',
          isOver
            ? 'bg-primary/5 ring-2 ring-primary/20 ring-inset'
            : 'bg-muted/30'
        )}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onLeadUpdate={onLeadUpdate} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className={cn(
            'flex-1 flex items-center justify-center rounded-md border-2 border-dashed min-h-[80px] transition-colors',
            isOver ? 'border-primary/40 bg-primary/5' : 'border-border/50'
          )}>
            <p className="text-xs text-muted-foreground/50 select-none">
              {isOver ? 'Soltar aqui' : 'Sem leads'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
