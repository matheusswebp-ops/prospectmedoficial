'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ExternalLink,
  MapPin,
  Globe,
  Zap,
  Clock,
  StickyNote,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScoreBadge } from './ScoreBadge'
import { WhatsAppButton } from './WhatsAppButton'
import { createClient } from '@/lib/supabase/client'
import type { LeadRow, KanbanActivityRow, LeadNoteRow } from '@/types/database'
import { TEMPLATE_PADRAO } from '@/lib/whatsapp/gerar-link'
import { cn } from '@/lib/utils'

interface LeadDetailSheetProps {
  lead: LeadRow
  open: boolean
  onClose: () => void
  onLeadUpdate?: (lead: LeadRow) => void
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
}

function LandingStatusBadge({ status }: { status: LeadRow['landing_page_status'] }) {
  switch (status) {
    case 'publicada':
      return (
        <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          LP no ar
        </Badge>
      )
    case 'gerando':
      return (
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Gerando…
        </Badge>
      )
    case 'erro':
      return (
        <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
          <AlertCircle className="w-3 h-3 mr-1" />
          Erro no deploy
        </Badge>
      )
    default:
      return (
        <Badge className="bg-gray-50 text-gray-600 border border-gray-200 text-xs font-medium">
          Não gerada
        </Badge>
      )
  }
}

export function LeadDetailSheet({
  lead: initialLead,
  open,
  onClose,
  onLeadUpdate,
}: LeadDetailSheetProps) {
  const [lead, setLead] = useState<LeadRow>(initialLead)
  const [activities, setActivities] = useState<KanbanActivityRow[]>([])
  const [notes, setNotes] = useState<LeadNoteRow[]>([])
  const [noteText, setNoteText] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isGeneratingLP, setIsGeneratingLP] = useState(false)

  const supabase = createClient()

  // Sync if parent updates the lead (e.g. after kanban move)
  useEffect(() => {
    setLead(initialLead)
  }, [initialLead])

  const loadDetails = useCallback(async () => {
    if (!open) return
    setIsLoadingDetails(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.lead) setLead(data.lead)
      if (data.activities) setActivities(data.activities)
      if (data.notes) setNotes(data.notes)
    } catch {
      // silently fail — UI still shows from initialLead
    } finally {
      setIsLoadingDetails(false)
    }
  }, [open, lead.id])

  useEffect(() => {
    if (open) {
      loadDetails()
    }
  }, [open, loadDetails])

  // Polling quando LP está gerando — atualiza a cada 4s até publicar ou errar
  useEffect(() => {
    if (!open || lead.landing_page_status !== 'gerando') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/leads/${lead.id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.lead) {
          setLead(data.lead)
          onLeadUpdate?.(data.lead)
          if (data.lead.landing_page_status !== 'gerando') clearInterval(interval)
        }
      } catch { /* silently retry */ }
    }, 4000)
    return () => clearInterval(interval)
  }, [open, lead.landing_page_status, lead.id, onLeadUpdate])

  async function handleAddNote() {
    if (!noteText.trim()) return
    setIsSavingNote(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { data: newNote, error } = await supabase
        .from('lead_note')
        .insert({ lead_id: lead.id, user_id: user.id, conteudo: noteText.trim() })
        .select('*')
        .single()

      if (error) throw error

      setNotes((prev) => [...prev, newNote])
      setNoteText('')
      toast.success('Nota adicionada.')
    } catch {
      toast.error('Erro ao adicionar nota.')
    } finally {
      setIsSavingNote(false)
    }
  }

  async function handleGenerateLP() {
    setIsGeneratingLP(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/landing-page`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? 'Erro ao iniciar geração')
      }
      toast.success('Geração de landing page iniciada!')
      setLead((prev) => ({ ...prev, landing_page_status: 'gerando' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar landing page'
      toast.error(message)
    } finally {
      setIsGeneratingLP(false)
    }
  }

  function handleLeadUpdate(updatedLead: LeadRow) {
    setLead(updatedLead)
    onLeadUpdate?.(updatedLead)
  }

  const pagespeedScore = lead.pagespeed_score ?? 0
  const pagespeedColor =
    pagespeedScore >= 70
      ? 'bg-emerald-500'
      : pagespeedScore >= 50
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">

        {/* ── Header ── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              {lead.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.foto_url}
                  alt={lead.nome}
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {getInitials(lead.nome)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground leading-tight truncate">
                {lead.nome}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{lead.especialidade}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{lead.cidade}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <ScoreBadge score={lead.score_total} />
                <LandingStatusBadge status={lead.landing_page_status} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-5">

          {/* ── Site e PageSpeed ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Site e Performance
            </h3>

            {lead.website_url ? (
              <div className="flex flex-col gap-2">
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 truncate"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{lead.website_url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                </a>

                {lead.pagespeed_score !== null ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        PageSpeed Mobile
                      </span>
                      <span className="font-semibold text-foreground">
                        {lead.pagespeed_score}/100
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pagespeedColor)}
                        style={{ width: `${lead.pagespeed_score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {lead.pagespeed_classificacao === 'site_ruim' && 'Site com performance ruim — ótima oportunidade de abordagem.'}
                      {lead.pagespeed_classificacao === 'site_medio' && 'Site com performance média.'}
                      {lead.pagespeed_classificacao === 'site_bom' && 'Site com boa performance.'}
                      {lead.pagespeed_classificacao === 'sem_site' && 'Sem site próprio.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Score não disponível.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum site encontrado.</p>
            )}
          </section>

          <Separator />

          {/* ── Landing Page ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Landing Page
            </h3>

            <div className="flex flex-col gap-2">
              <LandingStatusBadge status={lead.landing_page_status} />

              {lead.landing_page_status === 'publicada' && lead.landing_page_url && (
                <a
                  href={lead.landing_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{lead.landing_page_url}</span>
                </a>
              )}

              {(lead.landing_page_status === 'nao_gerada' || lead.landing_page_status === 'erro') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateLP}
                  disabled={isGeneratingLP}
                  className="w-fit"
                >
                  {isGeneratingLP ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Gerando…</>
                  ) : (
                    <><Globe className="w-3.5 h-3.5 mr-1.5" />
                      {lead.landing_page_status === 'erro' ? 'Tentar novamente' : 'Gerar Landing Page'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </section>

          <Separator />

          {/* ── WhatsApp ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Abordagem
            </h3>
            <WhatsAppButton
              lead={lead}
              template={TEMPLATE_PADRAO}
              size="sm"
              variant="outline"
              onStatusUpdate={handleLeadUpdate}
            />
            {lead.landing_page_status !== 'publicada' && (
              <p className="text-xs text-muted-foreground mt-2">
                O botão WhatsApp será habilitado quando a landing page estiver publicada.
              </p>
            )}
          </section>

          <Separator />

          {/* ── Histórico de movimentações ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Histórico de Movimentações
            </h3>

            {isLoadingDetails ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Carregando…
              </div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {activities.map((act) => (
                  <li key={act.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <ArrowRightLeft className="w-2.5 h-2.5 text-primary" />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-foreground font-medium">
                        {act.estagio_anterior}{' '}
                        <span className="text-muted-foreground font-normal">→</span>{' '}
                        {act.estagio_novo}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {format(new Date(act.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Separator />

          {/* ── Notas ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              Notas
            </h3>

            {notes.length > 0 ? (
              <ul className="flex flex-col gap-2 mb-3">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="flex flex-col gap-0.5 bg-muted/50 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {note.conteudo}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">Nenhuma nota ainda.</p>
            )}

            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Adicione uma nota sobre este lead…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!noteText.trim() || isSavingNote}
                onClick={handleAddNote}
                className="w-fit"
              >
                {isSavingNote ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Salvando…</>
                ) : (
                  <><Send className="w-3.5 h-3.5 mr-1.5" />Adicionar nota</>
                )}
              </Button>
            </div>
          </section>

        </div>
      </SheetContent>
    </Sheet>
  )
}
