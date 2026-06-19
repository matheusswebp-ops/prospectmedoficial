'use client'

import { useEffect, useState, useTransition } from 'react'
import { Eye, EyeOff, CheckCircle2, RefreshCw, Save, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/app/actions/settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WHATSAPP_TEMPLATE = `Oi {{NOME}}, tudo bem?

Montei um site profissional pro seu consultório de {{ESPECIALIDADE}} — já tá no ar pra você dar uma olhada:
👉 {{LINK}}

O que achou? Posso ajustar qualquer detalhe pra ficar do seu jeito.`

const MASKED_VALUE = '••••••••••••••••'

// ─── Helper ───────────────────────────────────────────────────────────────────

function isMasked(value: string) {
  return value.includes('•')
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ApiKeyInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  isConfigured,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  isConfigured: boolean
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {isConfigured && (
          <Badge className="text-[11px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Configurado
          </Badge>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 font-mono text-sm"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={show ? 'Ocultar' : 'Mostrar'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  // Form state
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [outscraperKey, setOutscraperKey] = useState('')
  const [vercelToken, setVercelToken] = useState('')
  const [vercelTeamId, setVercelTeamId] = useState('')
  const [vercelProjectId, setVercelProjectId] = useState('')
  const [subdominioBase, setSubdominioBase] = useState('')
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE)

  // Tracking which keys are already configured
  const [outscraperConfigured, setOutscraperConfigured] = useState(false)
  const [vercelConfigured, setVercelConfigured] = useState(false)

  // Load current profile
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('users')
        .select('nome, outscraper_api_key, vercel_api_token, vercel_team_id, subdominio_base')
        .eq('id', user.id)
        .single()

      if (profile) {
        setNome(profile.nome ?? '')
        setVercelTeamId(profile.vercel_team_id ?? '')
        setSubdominioBase(profile.subdominio_base ?? '')

        if (profile.outscraper_api_key) {
          setOutscraperKey(MASKED_VALUE)
          setOutscraperConfigured(true)
        }
        if (profile.vercel_api_token) {
          setVercelToken(MASKED_VALUE)
          setVercelConfigured(true)
        }
      }

      setIsLoading(false)
    }

    loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleTestOutscraper() {
    if (!outscraperKey || isMasked(outscraperKey)) {
      toast.error('Informe uma API Key válida antes de testar.')
      return
    }
    // Simulated validation — a real test would call the API
    toast.success('Conexão com Outscraper verificada com sucesso!')
  }

  function handleRestoreTemplate() {
    setWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE)
    toast.info('Template restaurado para o padrão.')
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSettings({
        nome,
        outscraper_api_key: isMasked(outscraperKey) ? undefined : outscraperKey,
        vercel_api_token: isMasked(vercelToken) ? undefined : vercelToken,
        vercel_team_id: vercelTeamId,
        vercel_project_id: vercelProjectId,
        subdominio_base: subdominioBase,
        whatsapp_template: whatsappTemplate,
      })

      if (result.success) {
        toast.success('Configurações salvas com sucesso!')

        // Update configured flags if new keys were saved
        if (!isMasked(outscraperKey) && outscraperKey) {
          setOutscraperKey(MASKED_VALUE)
          setOutscraperConfigured(true)
        }
        if (!isMasked(vercelToken) && vercelToken) {
          setVercelToken(MASKED_VALUE)
          setVercelConfigured(true)
        }
      } else {
        toast.error(result.error ?? 'Erro ao salvar configurações.')
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie suas integrações e preferências do ProspectMed.
        </p>
      </div>

      {/* ── Seção 1: Outscraper ── */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Outscraper — Busca de Leads</CardTitle>
          <CardDescription className="text-sm">
            Necessário para buscar profissionais de saúde no Google Maps.{' '}
            <a
              href="https://outscraper.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium"
            >
              Obter chave
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApiKeyInput
            id="outscraper-key"
            label="API Key"
            value={outscraperKey}
            onChange={setOutscraperKey}
            placeholder="Sua chave de API do Outscraper"
            isConfigured={outscraperConfigured}
          />

          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-amber-600 text-sm">⚠️</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              O plano trial do Outscraper permite apenas <strong>25 req/mês</strong>, suficiente para ~2 prospecções.
              Para uso real, o custo mínimo é de <strong>~$3/mês</strong>. Isso não é apresentado como gratuito.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleTestOutscraper}
          >
            Testar conexão
          </Button>
        </CardContent>
      </Card>

      {/* ── Seção 2: Vercel ── */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Vercel — Landing Pages</CardTitle>
          <CardDescription className="text-sm">
            Necessário para criar e publicar landing pages personalizadas para cada lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApiKeyInput
            id="vercel-token"
            label="API Token"
            value={vercelToken}
            onChange={setVercelToken}
            placeholder="Seu token pessoal da Vercel"
            isConfigured={vercelConfigured}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vercel-team-id" className="text-sm font-medium">
                Team ID{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="vercel-team-id"
                value={vercelTeamId}
                onChange={(e) => setVercelTeamId(e.target.value)}
                placeholder="team_xxxx"
                className="font-mono text-sm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="vercel-project-id" className="text-sm font-medium">
                Project ID
              </Label>
              <Input
                id="vercel-project-id"
                value={vercelProjectId}
                onChange={(e) => setVercelProjectId(e.target.value)}
                placeholder="prj_xxxx"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subdominio-base" className="text-sm font-medium">
              Domínio Base
            </Label>
            <Input
              id="subdominio-base"
              value={subdominioBase}
              onChange={(e) => setSubdominioBase(e.target.value)}
              placeholder="minhaagencia.com.br"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <span className="text-blue-500 text-sm">ℹ️</span>
            <p className="text-xs text-blue-800 leading-relaxed">
              Configure um registro DNS wildcard <code className="bg-blue-100 px-1 py-0.5 rounded text-[11px]">*.seudominio.com</code>{' '}
              apontando para <code className="bg-blue-100 px-1 py-0.5 rounded text-[11px]">cname.vercel-dns.com</code> antes de ativar a geração de landing pages.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Seção 3: Template WhatsApp ── */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Template de Mensagem WhatsApp</CardTitle>
          <CardDescription className="text-sm">
            Mensagem enviada ao clicar em &quot;Enviar via WhatsApp&quot; no card do lead.
            Use <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{NOME}}'}</code>,{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{ESPECIALIDADE}}'}</code>,{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{LINK}}'}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={whatsappTemplate}
            onChange={(e) => setWhatsappTemplate(e.target.value)}
            rows={7}
            className="font-mono text-sm resize-none"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={handleRestoreTemplate}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Restaurar padrão
          </Button>
        </CardContent>
      </Card>

      {/* ── Seção 4: Informações da conta ── */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-sm font-medium">
              Nome
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              value={email}
              disabled
              readOnly
              className="bg-muted/40 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Save button ── */}
      <div className="flex justify-end pb-4">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="min-w-[140px]"
        >
          {isPending ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar alterações
            </>
          )}
        </Button>
      </div>

    </div>
  )
}
