'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export default function RegenerarTodasButton() {
  const [loading, setLoading] = useState(false)

  async function handleRegenerar() {
    setLoading(true)
    try {
      const response = await fetch('/api/leads/regenerar-todas', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? 'Erro ao regenerar.')
        return
      }

      toast.success(`${data.queued} landing pages na fila. Atualize a página em alguns minutos.`)
      setTimeout(() => window.location.reload(), 2000)
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegenerar}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      {loading ? 'Regenerando...' : 'Regenerar Todas'}
    </Button>
  )
}
