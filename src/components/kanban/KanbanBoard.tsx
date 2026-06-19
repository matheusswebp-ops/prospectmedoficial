'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Search, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import { createClient } from '@/lib/supabase/client'
import type { KanbanStageRow, LeadRow } from '@/types/database'

// Stages that require confirmation before moving a lead into them
const TERMINAL_STAGES = ['Fechado', 'Sem interesse']

interface KanbanBoardProps {
  stages: KanbanStageRow[]
  initialLeads: LeadRow[]
  userId: string
}

interface PendingMove {
  leadId: string
  fromStage: string
  toStage: string
}

export function KanbanBoard({ stages, initialLeads, userId }: KanbanBoardProps) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEspecialidade, setFilterEspecialidade] = useState<string>('all')
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isMoving, setIsMoving] = useState(false)

  // Keep a ref to current leads for rollback inside async callbacks
  const leadsRef = useRef<LeadRow[]>(leads)
  leadsRef.current = leads

  const supabase = createClient()

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('crm-leads')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as LeadRow
            setLeads((prev) => {
              if (prev.find((l) => l.id === newLead.id)) return prev
              return [newLead, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as LeadRow
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l))
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setLeads((prev) => prev.filter((l) => l.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  // ── Derived data ──────────────────────────────────────────────────────────
  const especialidades = useMemo(() => {
    const set = new Set(leads.map((l) => l.especialidade))
    return Array.from(set).sort()
  }, [leads])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !searchQuery ||
        lead.nome.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesEsp =
        filterEspecialidade === 'all' || lead.especialidade === filterEspecialidade
      return matchesSearch && matchesEsp
    })
  }, [leads, searchQuery, filterEspecialidade])

  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadRow[]>()
    stages.forEach((s) => map.set(s.nome, []))
    filteredLeads.forEach((lead) => {
      if (map.has(lead.status_kanban)) {
        map.get(lead.status_kanban)!.push(lead)
      } else {
        // Lead belongs to a stage not in the list — put in first stage as fallback
        const firstStage = stages[0]?.nome
        if (firstStage) {
          if (!map.has(firstStage)) map.set(firstStage, [])
          map.get(firstStage)!.push(lead)
        }
      }
    })
    return map
  }, [stages, filteredLeads])

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null

  // ── Move lead (API call) ───────────────────────────────────────────────────
  const moveLead = useCallback(
    async (leadId: string, fromStage: string, toStage: string) => {
      // Optimistic update
      const snapshot = leadsRef.current
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status_kanban: toStage } : l
        )
      )

      setIsMoving(true)
      try {
        const res = await fetch(`/api/leads/${leadId}/kanban`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estagio: toStage }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error ?? 'Erro ao mover lead')
        }

        const { lead: updated } = await res.json()
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)))
      } catch (err) {
        // Rollback optimistic update
        setLeads(snapshot)
        const message = err instanceof Error ? err.message : 'Erro ao mover lead'
        toast.error(message)
      } finally {
        setIsMoving(false)
      }
    },
    []
  )

  // ── DnD handlers ──────────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const draggedId = active.id as string
    const overId = over.id as string

    // Find the lead being dragged
    const draggedLead = leads.find((l) => l.id === draggedId)
    if (!draggedLead) return

    // Determine destination stage: over.id could be a stage name OR a lead id
    let destinationStage: string | null = null

    // Check if overId is a stage name
    if (stages.some((s) => s.nome === overId)) {
      destinationStage = overId
    } else {
      // overId is a lead id — find its stage
      const overLead = leads.find((l) => l.id === overId)
      if (overLead) destinationStage = overLead.status_kanban
    }

    if (!destinationStage || destinationStage === draggedLead.status_kanban) return

    // If destination is a terminal stage — ask for confirmation
    if (TERMINAL_STAGES.includes(destinationStage)) {
      setPendingMove({
        leadId: draggedId,
        fromStage: draggedLead.status_kanban,
        toStage: destinationStage,
      })
      setIsConfirmOpen(true)
      return
    }

    moveLead(draggedId, draggedLead.status_kanban, destinationStage)
  }

  function handleConfirmMove() {
    if (!pendingMove) return
    const { leadId, fromStage, toStage } = pendingMove
    setIsConfirmOpen(false)
    setPendingMove(null)
    moveLead(leadId, fromStage, toStage)
  }

  function handleCancelMove() {
    setIsConfirmOpen(false)
    setPendingMove(null)
  }

  function handleLeadUpdate(updatedLead: LeadRow) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
    )
  }

  const hasActiveFilters = searchQuery || filterEspecialidade !== 'all'

  return (
    <>
      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Especialidade filter */}
        <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas especialidades</SelectItem>
            {especialidades.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchQuery('')
              setFilterEspecialidade('all')
            }}
          >
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}

        {/* Total badge */}
        <Badge
          variant="outline"
          className="ml-auto text-xs font-medium text-muted-foreground border-border"
        >
          <Users className="w-3 h-3 mr-1" />
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` de ${leads.length}`}
        </Badge>
      </div>

      {/* ── Kanban board ─────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage.get(stage.nome) ?? []}
              onLeadUpdate={handleLeadUpdate}
            />
          ))}
        </div>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay>
          {activeLead ? (
            <div className="rotate-2 opacity-95">
              <LeadCard lead={activeLead} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Confirm move to terminal stage ───────────────────────────────── */}
      <Dialog open={isConfirmOpen} onOpenChange={(v) => !v && handleCancelMove()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover para &ldquo;{pendingMove?.toStage}&rdquo;?</DialogTitle>
            <DialogDescription>
              Esta é uma etapa final. Tem certeza que deseja mover o lead para{' '}
              <span className="font-medium text-foreground">{pendingMove?.toStage}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={handleCancelMove} disabled={isMoving}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmMove} disabled={isMoving}>
              {isMoving ? 'Movendo…' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
