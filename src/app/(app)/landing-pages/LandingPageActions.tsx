'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface LandingPageActionsProps {
  leadId: string
}

/**
 * Botão "Regenerar" para landing pages com status 'erro'.
 * Client component para poder chamar a API route com fetch.
 */
export default function LandingPageActions({ leadId }: LandingPageActionsProps) {
  const [loading, setLoading] = useState(false)

  async function handleRegenerate() {
    setLoading(true)
    try {
      const response = await fetch(`/api/leads/${leadId}/landing-page`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? 'Erro ao regenerar landing page.')
        return
      }

      toast.success('Landing page colocada na fila para regeneração. Atualize a página em breve.')
      // Recarregar a página após breve delay para refletir o novo status 'gerando'
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error('Erro de conexão ao tentar regenerar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegenerate}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      Regenerar
    </Button>
  )
}
