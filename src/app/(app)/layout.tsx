import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verify session — redirect to login if unauthenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile to check onboarding state and leads_hoje
  const { data: profile } = await supabase
    .from('users')
    .select('outscraper_api_key, leads_hoje')
    .eq('id', user.id)
    .single()

  const showOnboardingBanner =
    profile !== null && !profile?.outscraper_api_key

  const leadsHoje: number = profile?.leads_hoje ?? 0

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar leadsHoje={leadsHoje} />

        {/* Onboarding banner */}
        {showOnboardingBanner && (
          <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Configure suas integrações para começar a prospectar leads.
              </span>
            </div>
            <Link
              href="/configuracoes"
              className="text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap shrink-0"
            >
              Configurações →
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
