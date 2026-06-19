'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScoreBadge } from '@/components/leads/ScoreBadge'
import { WhatsAppButton } from '@/components/leads/WhatsAppButton'
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet'
import type { LeadRow } from '@/types/database'
import { cn } from '@/lib/utils'

interface LeadCardProps {
  lead: LeadRow
  onLeadUpdate?: (lead: LeadRow) => void
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
}

export function LeadCard({ lead: initialLead, onLeadUpdate }: LeadCardProps) {
  const [lead, setLead] = useState<LeadRow>(initialLead)
  const [detailOpen, setDetailOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  function handleLeadUpdate(updatedLead: LeadRow) {
    setLead(updatedLead)
    onLeadUpdate?.(updatedLead)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'bg-card rounded-lg border border-border p-3 flex flex-col gap-2 shadow-card',
          'cursor-grab active:cursor-grabbing select-none',
          'transition-shadow duration-150',
          'hover:shadow-card-hover',
          isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20'
        )}
        {...attributes}
        {...listeners}
      >
        {/* Row 1: Avatar + Name */}
        <div className="flex items-start gap-2.5">
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {lead.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lead.foto_url}
                alt={lead.nome}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {getInitials(lead.nome)}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="flex-1 min-w-0 text-left"
            onClick={(e) => {
              e.stopPropagation()
              setDetailOpen(true)
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground leading-tight truncate hover:text-primary transition-colors">
              {lead.nome}
            </p>
          </button>
        </div>

        {/* Row 2: Especialidade */}
        <p className="text-xs text-muted-foreground leading-tight truncate -mt-1 ml-[46px]">
          {lead.especialidade}
        </p>

        {/* Row 3: Cidade */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/60" />
          <span className="truncate">{lead.cidade}</span>
        </div>

        {/* Row 4: Score + WhatsApp button */}
        <div
          className="flex items-center justify-between gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ScoreBadge score={lead.score_total} />
          <WhatsAppButton
            lead={lead}
            size="icon"
            onStatusUpdate={handleLeadUpdate}
          />
        </div>

        {/* Row 5: LP badge (only when published) */}
        {lead.landing_page_status === 'publicada' && (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-1.5 py-0 h-4.5 font-medium gap-1">
              <Globe className="w-2.5 h-2.5" />
              LP no ar
            </Badge>
          </div>
        )}
      </div>

      {/* Detail Sheet — rendered outside draggable so pointer events work */}
      <LeadDetailSheet
        lead={lead}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onLeadUpdate={handleLeadUpdate}
      />
    </>
  )
}
