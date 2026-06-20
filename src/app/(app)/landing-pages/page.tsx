import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ExternalLink,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { LandingStatus } from '@/types/database'
import LandingPageActions from './LandingPageActions'
import RegenerarTodasButton from './RegerarTodasButton'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface LeadComLanding {
  id: string
  nome: string
  especialidade: string
  cidade: string
  telefone: string | null
  landing_page_url: string | null
  landing_page_status: LandingStatus
  updated_at: string
  foto_url: string | null
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LandingStatus }) {
  switch (status) {
    case 'publicada':
      return (
        <Badge className="gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
          <CheckCircle2 className="w-3 h-3" />
          Publicada
        </Badge>
      )
    case 'gerando':
      return (
        <Badge className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50">
          <Loader2 className="w-3 h-3 animate-spin" />
          Gerando...
        </Badge>
      )
    case 'erro':
      return (
        <Badge className="gap-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
          <AlertCircle className="w-3 h-3" />
          Erro
        </Badge>
      )
    default:
      return (
        <Badge className="gap-1.5 bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-50">
          Não gerada
        </Badge>
      )
  }
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
}

// ── Componente da página (Server Component) ───────────────────────────────────

export default async function LandingPagesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Buscar todos os leads que já tiveram alguma ação de landing page
  const { data: leads, error } = await supabase
    .from('leads')
    .select(
      'id, nome, especialidade, cidade, telefone, landing_page_url, landing_page_status, updated_at, foto_url'
    )
    .eq('user_id', user.id)
    .neq('landing_page_status', 'nao_gerada')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[landing-pages/page] Erro ao buscar leads:', error.message)
  }

  const leadsComLanding: LeadComLanding[] = leads ?? []

  // Métricas
  const totalPublicadas = leadsComLanding.filter((l) => l.landing_page_status === 'publicada').length
  const totalGerando = leadsComLanding.filter((l) => l.landing_page_status === 'gerando').length
  const totalErro = leadsComLanding.filter((l) => l.landing_page_status === 'erro').length

  // Verificar se o usuário tem vercel_api_token configurado
  const { data: profile } = await supabase
    .from('users')
    .select('vercel_api_token')
    .eq('id', user.id)
    .single()

  const hasVercelToken = Boolean(profile?.vercel_api_token)

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Landing Pages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sites de demonstração gerados automaticamente para cada lead qualificado.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">
            {totalPublicadas} ativa{totalPublicadas !== 1 ? 's' : ''}
          </span>
          <RegenerarTodasButton />
        </div>
      </div>

      {/* ── Alerta de configuração ─────────────────────────────────────────── */}
      {!hasVercelToken && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Vercel API Token não configurado</p>
            <p className="text-amber-700">
              Para gerar landing pages, configure seu Vercel API Token em{' '}
              <Link href="/configuracoes" className="underline underline-offset-2 font-medium hover:text-amber-900">
                Configurações
              </Link>
              . Você também precisará de um domínio wildcard configurado ({' '}
              <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">*.seudominio.com.br</code>
              ).
            </p>
          </div>
        </div>
      )}

      {/* ── Aviso sobre DNS Wildcard ──────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-semibold mb-0.5">Requisito de domínio wildcard</p>
          <p className="text-blue-700">
            Landing pages requerem um domínio wildcard configurado na Vercel (
            <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">*.seudominio.com.br</code>
            ). Sem ele, os sites ficam em <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">.vercel.app</code>.
            Todas as páginas têm <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">noindex</code>{' '}
            obrigatório (compliance LGPD). Não compartilhe os links publicamente.
          </p>
        </div>
      </div>

      {/* ── Cards de métricas ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{totalPublicadas}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Publicadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Loader2 className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{totalGerando}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Em geração</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4.5 h-4.5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{totalErro}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Com erro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Lista de landing pages ─────────────────────────────────────────── */}
      {leadsComLanding.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Globe className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma landing page ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            As landing pages são geradas automaticamente durante o processo de prospecção.
            Inicie uma prospecção no{' '}
            <Link href="/dashboard" className="text-primary underline underline-offset-2 hover:opacity-80">
              Dashboard
            </Link>{' '}
            para começar.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {leadsComLanding.map((lead) => (
            <Card key={lead.id} className="border border-border hover:border-border/80 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {lead.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lead.foto_url}
                        alt={lead.nome}
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {getInitials(lead.nome)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        Dr(a). {lead.nome}
                      </span>
                      <StatusBadge status={lead.landing_page_status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{lead.especialidade}</span>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground">{lead.cidade}</span>
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(lead.updated_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {/* URL se publicada */}
                    {lead.landing_page_status === 'publicada' && lead.landing_page_url && (
                      <a
                        href={lead.landing_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline underline-offset-2"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[320px]">{lead.landing_page_url}</span>
                      </a>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.landing_page_status === 'publicada' && lead.landing_page_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={lead.landing_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir
                        </a>
                      </Button>
                    )}

                    {lead.landing_page_status === 'erro' && (
                      <LandingPageActions leadId={lead.id} />
                    )}

                    {lead.landing_page_status === 'gerando' && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Processando...
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
