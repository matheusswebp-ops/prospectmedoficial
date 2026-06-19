import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  UserPlus,
  Users,
  MessageCircle,
  Globe,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchStatus = 'idle' | 'running' | 'filtering' | 'scoring' | 'delivering' | 'completed' | 'partial' | 'failed'

interface RecentBatch {
  id: string
  cidade: string
  especialidade: string
  status: BatchStatus
  total_novos: number | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusConfig(status: BatchStatus) {
  switch (status) {
    case 'completed':
      return { icon: CheckCircle2, color: 'text-emerald-500', label: 'Concluído', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'partial':
      return { icon: CheckCircle2, color: 'text-amber-500', label: 'Parcial', badge: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'running':
    case 'filtering':
    case 'scoring':
    case 'delivering':
      return { icon: Loader2, color: 'text-primary animate-spin', label: 'Processando', badge: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'failed':
      return { icon: XCircle, color: 'text-destructive', label: 'Falhou', badge: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return { icon: Clock, color: 'text-muted-foreground', label: 'Aguardando', badge: 'bg-gray-50 text-gray-600 border-gray-200' }
  }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('nome, leads_hoje, outscraper_api_key')
    .eq('id', user.id)
    .single()

  // Fetch lead counts grouped by status_kanban
  const { data: leads } = await supabase
    .from('leads')
    .select('status_kanban, landing_page_status')
    .eq('user_id', user.id)

  // Fetch last 3 batches
  const { data: batches } = await supabase
    .from('prospeccao_batch')
    .select('id, cidade, especialidade, status, total_novos, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const leadsHoje: number = profile?.leads_hoje ?? 0
  const isLimitReached = leadsHoje >= 12
  const isApiKeyMissing = !profile?.outscraper_api_key
  const isProspeccaoDisabled = isLimitReached || isApiKeyMissing

  const totalLeads = leads?.length ?? 0
  const abordados = leads?.filter((l) => l.status_kanban === 'Abordado').length ?? 0
  const landingPages = leads?.filter((l) => l.landing_page_status === 'publicada').length ?? 0

  const recentBatches: RecentBatch[] = (batches ?? []) as RecentBatch[]

  const displayName = profile?.nome
    ? profile.nome.split(' ')[0]
    : user.email?.split('@')[0] ?? ''

  const today = formatDate(new Date())
  const greeting = getGreeting()

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">

      {/* ── Hero ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {greeting}, {displayName}! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">{today}</p>
      </div>

      {/* ── Metrics grid ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

        {/* Leads Hoje */}
        <Link href="/prospeccao">
          <Card className="shadow-card border-border hover:shadow-card-hover hover:border-primary/20 transition-all cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Leads Hoje
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-foreground">{leadsHoje}</span>
                    <span className="text-sm text-muted-foreground font-medium">/12</span>
                  </div>
                  {isLimitReached ? (
                    <Badge className="w-fit bg-red-50 text-red-700 border border-red-200 text-[11px] px-1.5 py-0.5">
                      Limite atingido
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {12 - leadsHoje} restantes hoje
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Total Leads */}
        <Link href="/crm">
          <Card className="shadow-card border-border hover:shadow-card-hover hover:border-emerald-200 transition-all cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total de Leads
                  </span>
                  <span className="text-3xl font-bold text-foreground">{totalLeads}</span>
                  <span className="text-xs text-muted-foreground">no seu CRM</span>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Abordados */}
        <Link href="/crm">
          <Card className="shadow-card border-border hover:shadow-card-hover hover:border-amber-200 transition-all cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Abordados
                  </span>
                  <span className="text-3xl font-bold text-foreground">{abordados}</span>
                  <span className="text-xs text-muted-foreground">mensagens enviadas</span>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 shrink-0 group-hover:bg-amber-100 transition-colors">
                  <MessageCircle className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Landing Pages */}
        <Link href="/landing-pages">
          <Card className="shadow-card border-border hover:shadow-card-hover hover:border-violet-200 transition-all cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Landing Pages
                  </span>
                  <span className="text-3xl font-bold text-foreground">{landingPages}</span>
                  <span className="text-xs text-muted-foreground">páginas publicadas</span>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-50 shrink-0 group-hover:bg-violet-100 transition-colors">
                  <Globe className="w-5 h-5 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Main action + Recent batches ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Ação principal */}
        <Card className="shadow-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                <Search className="w-4.5 h-4.5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">Prospecção Diária</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Busque automaticamente <span className="font-medium text-foreground">12 novos leads qualificados</span> no Google Maps, avalie os sites e receba contatos prontos para abordagem.
            </p>

            <div className="flex flex-col gap-2">
              {isProspeccaoDisabled ? (
                <>
                  <Button
                    disabled
                    className="w-full opacity-60 cursor-not-allowed"
                  >
                    {isApiKeyMissing ? 'Configure sua API key primeiro' : 'Limite diário atingido'}
                    <ArrowRight className="ml-1.5 w-4 h-4" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    {isApiKeyMissing
                      ? 'Acesse Configurações e informe sua chave Outscraper.'
                      : 'Próximo reset às 6h de amanhã (BRT).'}
                  </p>
                </>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/prospeccao">
                    Começar Prospecção
                    <ArrowRight className="ml-1.5 w-4 h-4" />
                  </Link>
                </Button>
              )}
            </div>

            {/* Progresso de hoje */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Progresso diário</span>
                <span className="text-xs font-medium text-foreground">{leadsHoje}/12</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min((leadsHoje / 12) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico recente */}
        <Card className="shadow-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Histórico Recente</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs h-7 text-primary hover:text-primary">
                <Link href="/crm">
                  Ver CRM
                  <ArrowRight className="ml-1 w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                  <Search className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Nenhuma prospecção ainda</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Comece agora para ver leads aparecerem aqui.</p>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border -mx-1">
                {recentBatches.map((batch) => {
                  const { icon: StatusIcon, color, label, badge } = getStatusConfig(batch.status)
                  const timeAgo = formatDistanceToNow(new Date(batch.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })

                  return (
                    <li key={batch.id} className="flex items-center gap-3 px-1 py-3">
                      <StatusIcon className={`w-4 h-4 shrink-0 ${color}`} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground truncate capitalize">
                          {batch.especialidade} em {batch.cidade}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`text-[11px] px-1.5 py-0.5 border font-medium ${badge}`}>
                          {label}
                        </Badge>
                        {typeof batch.total_novos === 'number' && (
                          <span className="text-[11px] text-muted-foreground">
                            {batch.total_novos} leads
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
