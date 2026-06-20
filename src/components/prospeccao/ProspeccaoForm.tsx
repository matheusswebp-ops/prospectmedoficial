'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  MapPin,
  Stethoscope,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Constants ────────────────────────────────────────────────────────────────

const ESPECIALIDADES = [
  'Médico Clínico Geral',
  'Dentista',
  'Fisioterapeuta',
  'Psicólogo',
  'Nutricionista',
  'Oftalmologista',
  'Dermatologista',
  'Pediatra',
  'Ortopedista',
  'Cardiologista',
  'Ginecologista',
  'Urologista',
  'Neurologista',
  'Endocrinologista',
  'Gastroenterologista',
  'Reumatologista',
  'Otorrinolaringologista',
  'Cirurgião Geral',
  'Psiquiatra',
  'Médico Veterinário',
]

const STORAGE_KEY = 'prospectmed_active_batch'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'form' | 'running' | 'completed' | 'failed'

interface Totais {
  encontrados: number
  novos: number
  duplicados: number
}

interface Props {
  leadsHoje: number
}

interface StoredBatch {
  batchId: string
  cidade: string
  especialidade: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusText(progresso: number): string {
  if (progresso <= 15) return 'Buscando no Google Maps...'
  if (progresso <= 35) return 'Filtrando leads duplicados...'
  if (progresso <= 55) return 'Avaliando sites (PageSpeed)...'
  if (progresso <= 75) return 'Calculando scores...'
  if (progresso <= 99) return 'Inserindo leads no CRM...'
  return 'Concluído!'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProspeccaoForm({ leadsHoje }: Props) {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('form')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [statusText, setStatusText] = useState('Iniciando...')
  const [totais, setTotais] = useState<Totais>({ encontrados: 0, novos: 0, duplicados: 0 })
  const [erroMsg, setErroMsg] = useState<string | null>(null)

  const [especialidade, setEspecialidade] = useState('')
  const [cidade, setCidade] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLimitReached = leadsHoje >= 12

  // Ref para o interval para que o visibilitychange possa cancelar e recriar
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>('form')
  const batchIdRef = useRef<string | null>(null)

  phaseRef.current = phase
  batchIdRef.current = batchId

  // ── Restaurar prospecção ativa ao montar ─────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const { batchId: savedId, cidade: savedCidade, especialidade: savedEsp } = JSON.parse(stored) as StoredBatch
      if (savedId) {
        setBatchId(savedId)
        setCidade(savedCidade)
        setEspecialidade(savedEsp)
        setProgresso(5)
        setStatusText('Retomando acompanhamento...')
        setPhase('running')
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Função de poll ───────────────────────────────────────────────────────────
  const poll = useCallback(async (id: string) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const res = await fetch(`/api/prospeccao/status/${id}`, { signal: controller.signal })
      clearTimeout(timeout)

      if (res.status === 404) {
        // Batch não existe mais — limpar localStorage e resetar
        localStorage.removeItem(STORAGE_KEY)
        if (intervalRef.current) clearInterval(intervalRef.current)
        handleReset()
        return
      }
      if (!res.ok) return
      const data = await res.json()

      const p = data.progresso ?? 0
      setProgresso(p)
      setStatusText(getStatusText(p))
      setTotais({
        encontrados: data.total_encontrados ?? 0,
        novos: data.total_novos ?? 0,
        duplicados: data.total_duplicados ?? 0,
      })

      if (data.status === 'completed' || data.status === 'partial') {
        setProgresso(100)
        setStatusText('Concluído!')
        setTotais({
          encontrados: data.total_encontrados ?? 0,
          novos: data.total_novos ?? 0,
          duplicados: data.total_duplicados ?? 0,
        })
        setPhase('completed')
        localStorage.removeItem(STORAGE_KEY)
        if (intervalRef.current) clearInterval(intervalRef.current)
        router.refresh()
        return
      }

      if (data.status === 'failed') {
        setErroMsg(data.erro_mensagem ?? 'Erro desconhecido. Tente novamente.')
        setPhase('failed')
        localStorage.removeItem(STORAGE_KEY)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } catch {
      // timeout ou rede — tenta na próxima iteração
    }
  }, [router])

  // ── Polling ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running' || !batchId) return

    // Poll imediato ao entrar em 'running'
    poll(batchId)

    intervalRef.current = setInterval(() => poll(batchId), 3000)

    // Retomar polling ao voltar para a aba
    function handleVisibility() {
      if (document.visibilityState === 'visible' && phaseRef.current === 'running' && batchIdRef.current) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        poll(batchIdRef.current)
        intervalRef.current = setInterval(() => poll(batchIdRef.current!), 3000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [phase, batchId, poll])

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!especialidade || !cidade.trim() || isLimitReached) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/prospeccao/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cidade: cidade.trim(), especialidade }),
      })

      if (!res.ok) {
        const err = await res.json()
        setErroMsg(err.error ?? 'Falha ao iniciar prospecção.')
        setPhase('failed')
        return
      }

      const { batchId: newBatchId } = await res.json()
      if (!newBatchId) {
        setErroMsg('Erro ao iniciar (ID inválido). Tente novamente.')
        setPhase('failed')
        return
      }

      // Persistir no localStorage para sobreviver à navegação
      const stored: StoredBatch = { batchId: newBatchId, cidade: cidade.trim(), especialidade }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      setBatchId(newBatchId)
      setProgresso(5)
      setStatusText('Iniciando busca...')
      setPhase('running')
    } catch {
      setErroMsg('Falha na conexão. Verifique sua internet e tente novamente.')
      setPhase('failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY)
    setPhase('form')
    setBatchId(null)
    setProgresso(0)
    setStatusText('')
    setTotais({ encontrados: 0, novos: 0, duplicados: 0 })
    setErroMsg(null)
    setEspecialidade('')
    setCidade('')
  }

  // ── Render: Form ─────────────────────────────────────────────────────────────
  if (phase === 'form') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {isLimitReached && (
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <span className="mt-0.5 text-amber-500 font-bold text-base leading-none">!</span>
            <div>
              <p className="font-medium">Limite diário atingido</p>
              <p className="text-amber-700 mt-0.5">
                Você já prospectou 12 leads hoje. Volte amanhã para continuar.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="especialidade" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
              Especialidade
            </Label>
            <Select
              value={especialidade}
              onValueChange={setEspecialidade}
              disabled={isLimitReached}
            >
              <SelectTrigger id="especialidade" className="h-10 bg-white border-border">
                <SelectValue placeholder="Selecione a especialidade..." />
              </SelectTrigger>
              <SelectContent>
                {ESPECIALIDADES.map((esp) => (
                  <SelectItem key={esp} value={esp}>
                    {esp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cidade" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              Cidade
            </Label>
            <Input
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: São Paulo, Campinas, Curitiba..."
              disabled={isLimitReached}
              className="h-10 bg-white border-border"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {isLimitReached
              ? 'Limite de 12 leads/dia atingido'
              : `${12 - leadsHoje} slots disponíveis hoje`}
          </p>
          <Button
            type="submit"
            disabled={isLimitReached || !especialidade || !cidade.trim() || isSubmitting}
            className="bg-[#4F6EF5] hover:bg-[#3d5de0] text-white font-medium px-6 gap-2 shrink-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                Iniciar Prospecção
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    )
  }

  // ── Render: Running ───────────────────────────────────────────────────────────
  if (phase === 'running') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#4F6EF5]/10 shrink-0">
            <Loader2 className="w-5 h-5 text-[#4F6EF5] animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{statusText}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {especialidade} em {cidade}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Progress value={progresso} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progresso}% concluído</span>
            <span>aguarde...</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-foreground">{totais.encontrados}</p>
            <p className="text-xs text-muted-foreground mt-0.5">encontrados</p>
          </div>
          <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-emerald-600">{totais.novos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">novos leads</p>
          </div>
          <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-amber-600">{totais.duplicados}</p>
            <p className="text-xs text-muted-foreground mt-0.5">duplicados</p>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Pode navegar à vontade — a prospecção continua em segundo plano e atualiza automaticamente ao voltar.
        </p>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground gap-2"
            onClick={handleReset}
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancelar acompanhamento
          </Button>
        </div>
      </div>
    )
  }

  // ── Render: Completed ─────────────────────────────────────────────────────────
  if (phase === 'completed') {
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>

        <div>
          <p className="text-lg font-semibold text-foreground">Prospecção concluída!</p>
          <p className="text-sm text-muted-foreground mt-1">
            {totais.novos} novo{totais.novos !== 1 ? 's' : ''} lead{totais.novos !== 1 ? 's' : ''} adicionado{totais.novos !== 1 ? 's' : ''} ao CRM.
            {totais.duplicados > 0 && ` ${totais.duplicados} duplicado${totais.duplicados !== 1 ? 's' : ''} filtrado${totais.duplicados !== 1 ? 's' : ''}.`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-foreground">{totais.encontrados}</p>
            <p className="text-xs text-muted-foreground mt-0.5">encontrados</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-emerald-600">{totais.novos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">novos</p>
          </div>
          <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-amber-600">{totais.duplicados}</p>
            <p className="text-xs text-muted-foreground mt-0.5">filtrados</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Button asChild className="bg-[#4F6EF5] hover:bg-[#3d5de0] text-white font-medium gap-2">
            <Link href="/crm">
              Ver leads no CRM
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4" />
            Nova prospecção
          </Button>
        </div>
      </div>
    )
  }

  // ── Render: Failed ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
        <XCircle className="w-8 h-8 text-red-500" />
      </div>

      <div>
        <p className="text-lg font-semibold text-foreground">Erro na prospecção</p>
        {erroMsg ? (
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">{erroMsg}</p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            Algo deu errado. Verifique suas configurações e tente novamente.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Button
          onClick={handleReset}
          className="bg-[#4F6EF5] hover:bg-[#3d5de0] text-white font-medium gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar novamente
        </Button>
        <Button variant="outline" asChild className="text-muted-foreground">
          <Link href="/configuracoes">Verificar configurações</Link>
        </Button>
      </div>
    </div>
  )
}
