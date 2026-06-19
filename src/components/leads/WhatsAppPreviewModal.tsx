'use client'

import { useState } from 'react'
import { ExternalLink, MessageCircle, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { gerarLinkWhatsApp, renderizarTemplate } from '@/lib/whatsapp/gerar-link'
import type { LeadRow } from '@/types/database'

type Step = 'preview' | 'confirm'

interface WhatsAppPreviewModalProps {
  lead: LeadRow
  template: string
  open: boolean
  onClose: () => void
  onStatusUpdate?: (updatedLead: LeadRow) => void
}

export function WhatsAppPreviewModal({
  lead,
  template,
  open,
  onClose,
  onStatusUpdate,
}: WhatsAppPreviewModalProps) {
  const [step, setStep] = useState<Step>('preview')
  const [fallbackLink, setFallbackLink] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  const mensagem = renderizarTemplate(template, {
    nome: lead.nome,
    especialidade: lead.especialidade,
    link: lead.landing_page_url ?? '[link da landing page]',
  })

  const waLink = lead.telefone_e164
    ? gerarLinkWhatsApp(lead.telefone_e164, mensagem)
    : null

  function handleSendClick() {
    if (!waLink) return

    // window.open must be called DIRECTLY inside the click handler — no setTimeout, no async gap
    const win = window.open(waLink, '_blank', 'noopener,noreferrer')

    if (win === null) {
      // Popup was blocked — show fallback link
      setFallbackLink(waLink)
    } else {
      // Popup opened successfully — advance to confirm step
      setStep('confirm')
    }
  }

  async function handleConfirmSent() {
    if (lead.status_kanban === 'Abordado') {
      toast.success('Lead já marcado como abordado.')
      onClose()
      return
    }

    setIsMoving(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/kanban`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estagio: 'Abordado' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Erro ao mover lead')
      }

      const { lead: updatedLead } = await res.json()
      onStatusUpdate?.(updatedLead)
      toast.success(`${lead.nome} movido para "Abordado".`)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar lead'
      toast.error(message)
    } finally {
      setIsMoving(false)
    }
  }

  function handleNotSent() {
    onClose()
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      onClose()
      // Reset state for next time
      setStep('preview')
      setFallbackLink(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'preview' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                Prévia da Mensagem WhatsApp
              </DialogTitle>
              <DialogDescription>
                Revise a mensagem antes de enviar para{' '}
                <span className="font-medium text-foreground">{lead.nome}</span>.
              </DialogDescription>
            </DialogHeader>

            {/* Message preview bubble */}
            <div className="mt-2">
              <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap shadow-sm max-w-[85%]">
                {mensagem}
              </div>
            </div>

            {/* Recipient info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <span className="font-medium">Para:</span>
              <span>{lead.telefone ?? lead.telefone_e164 ?? '—'}</span>
              <span className="text-muted-foreground/50 mx-1">·</span>
              <span className="truncate">{lead.nome}</span>
            </div>

            {/* Fallback link when popup was blocked */}
            {fallbackLink && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm">
                <ExternalLink className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-amber-800 font-medium text-xs">
                    Popup bloqueado pelo navegador
                  </span>
                  <a
                    href={fallbackLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 break-all text-xs"
                    onClick={() => setStep('confirm')}
                  >
                    Clique aqui para abrir o WhatsApp
                  </a>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSendClick}
                disabled={!waLink}
              >
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Enviar via WhatsApp
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Mensagem enviada?
              </DialogTitle>
              <DialogDescription>
                Se você enviou a mensagem, o lead será movido para{' '}
                <span className="font-medium text-foreground">&ldquo;Abordado&rdquo;</span> no CRM.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={handleNotSent}
                disabled={isMoving}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Não enviei
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmSent}
                disabled={isMoving}
              >
                {isMoving ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Sim, enviei!
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
