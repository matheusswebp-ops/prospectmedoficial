import { redirect } from 'next/navigation'
import { Target, History } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ProspeccaoForm from '@/components/prospeccao/ProspeccaoForm'
import BatchHistorico from '@/components/prospeccao/BatchHistorico'
import type { ProspeccaoBatchRow } from '@/types/database'

export default async function ProspeccaoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch user data
  const { data: profile } = await supabase
    .from('users')
    .select('leads_hoje, leads_reset_at')
    .eq('id', user.id)
    .single()

  // Fetch last 5 batches
  const { data: batches } = await supabase
    .from('prospeccao_batch')
    .select(
      'id, cidade, especialidade, status, total_novos, total_encontrados, total_duplicados, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const leadsHoje = profile?.leads_hoje ?? 0
  const recentBatches = (batches ?? []) as ProspeccaoBatchRow[]

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Target className="w-6 h-6 text-[#4F6EF5]" />
          Prospecção Diária
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre 12 novos leads qualificados automaticamente
        </p>
      </div>

      {/* ── Slots indicator ── */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-5 rounded-sm transition-colors ${
                i < leadsHoje
                  ? 'bg-[#4F6EF5]'
                  : 'bg-muted border border-border'
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground font-medium">
          {leadsHoje}/12 leads hoje
        </span>
      </div>

      {/* ── Main form card ── */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground">
            Iniciar nova prospecção
          </CardTitle>
          <p className="text-sm text-muted-foreground -mt-1">
            O sistema busca profissionais no Google Maps, avalia os sites deles e seleciona os{' '}
            <span className="font-medium text-foreground">12 melhores leads</span> para você abordar hoje.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <ProspeccaoForm leadsHoje={leadsHoje} />
        </CardContent>
      </Card>

      {/* ── Batch history ── */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Histórico de prospecções
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <BatchHistorico batches={recentBatches} />
        </CardContent>
      </Card>

    </div>
  )
}
