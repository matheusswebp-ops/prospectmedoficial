'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Search,
  MapPin,
  Stethoscope,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { ProspeccaoBatchRow, BatchStatus } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface StatusConfig {
  icon: React.ElementType
  iconClass: string
  label: string
  badgeClass: string
}

function getStatusConfig(status: BatchStatus): StatusConfig {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        iconClass: 'text-emerald-500',
        label: 'Concluído',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      }
    case 'partial':
      return {
        icon: CheckCircle2,
        iconClass: 'text-amber-500',
        label: 'Parcial',
        badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      }
    case 'running':
    case 'filtering':
    case 'scoring':
    case 'delivering':
      return {
        icon: Loader2,
        iconClass: 'text-[#4F6EF5] animate-spin',
        label: 'Processando',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
      }
    case 'failed':
      return {
        icon: XCircle,
        iconClass: 'text-red-500',
        label: 'Falhou',
        badgeClass: 'bg-red-50 text-red-700 border border-red-200',
      }
    case 'idle':
    default:
      return {
        icon: Clock,
        iconClass: 'text-muted-foreground',
        label: 'Aguardando',
        badgeClass: 'bg-gray-50 text-gray-600 border border-gray-200',
      }
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  batches: ProspeccaoBatchRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BatchHistorico({ batches }: Props) {
  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
          <Search className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhuma prospecção ainda</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inicie sua primeira prospecção para encontrar leads qualificados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {batches.map((batch) => {
        const config = getStatusConfig(batch.status as BatchStatus)
        const Icon = config.icon

        const timeAgo = formatDistanceToNow(new Date(batch.created_at), {
          addSuffix: true,
          locale: ptBR,
        })

        return (
          <li
            key={batch.id}
            className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
          >
            {/* Status icon */}
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted shrink-0">
              <Icon className={`w-4 h-4 ${config.iconClass}`} />
            </div>

            {/* Info */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-sm font-medium text-foreground truncate">
                  <Stethoscope className="w-3 h-3 text-muted-foreground shrink-0" />
                  {batch.especialidade}
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {batch.cidade}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>

            {/* Right side: badge + count */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                {config.label}
              </Badge>
              {(batch.status === 'completed' || batch.status === 'partial') &&
                typeof batch.total_novos === 'number' && (
                  <span className="text-xs text-muted-foreground">
                    {batch.total_novos} novo{batch.total_novos !== 1 ? 's' : ''}
                  </span>
                )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
