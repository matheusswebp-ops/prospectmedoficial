'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal'
import type { LeadRow } from '@/types/database'
import { TEMPLATE_PADRAO } from '@/lib/whatsapp/gerar-link'

interface WhatsAppButtonProps {
  lead: LeadRow
  template?: string
  size?: 'default' | 'sm' | 'icon'
  variant?: 'default' | 'outline' | 'ghost'
  onStatusUpdate?: (updatedLead: LeadRow) => void
}

export function WhatsAppButton({
  lead,
  template = TEMPLATE_PADRAO,
  size = 'sm',
  variant = 'outline',
  onStatusUpdate,
}: WhatsAppButtonProps) {
  const [open, setOpen] = useState(false)

  const isDisabled =
    lead.landing_page_status !== 'publicada' || !lead.telefone_e164

  const disabledReason = !lead.telefone_e164
    ? 'Telefone inválido ou ausente'
    : lead.landing_page_status !== 'publicada'
    ? 'Landing page ainda não publicada'
    : undefined

  if (size === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (!isDisabled) setOpen(true)
          }}
          disabled={isDisabled}
          title={isDisabled ? disabledReason : 'Enviar WhatsApp'}
          className={[
            'flex items-center justify-center w-7 h-7 rounded-md transition-colors',
            isDisabled
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
          ].join(' ')}
        >
          <MessageCircle className="w-4 h-4" />
        </button>

        {open && (
          <WhatsAppPreviewModal
            lead={lead}
            template={template}
            open={open}
            onClose={() => setOpen(false)}
            onStatusUpdate={onStatusUpdate}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        disabled={isDisabled}
        title={isDisabled ? disabledReason : undefined}
        onClick={() => setOpen(true)}
        className={
          !isDisabled && variant !== 'default'
            ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
            : undefined
        }
      >
        <MessageCircle className="w-4 h-4 mr-1.5" />
        WhatsApp
      </Button>

      {open && (
        <WhatsAppPreviewModal
          lead={lead}
          template={template}
          open={open}
          onClose={() => setOpen(false)}
          onStatusUpdate={onStatusUpdate}
        />
      )}
    </>
  )
}
