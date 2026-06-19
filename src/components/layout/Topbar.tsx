'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, Settings, LogOut, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/prospeccao': 'Prospecção',
  '/crm': 'CRM / Leads',
  '/landing-pages': 'Landing Pages',
  '/configuracoes': 'Configurações',
}

function getPageLabel(pathname: string): string {
  // Exact match first
  if (routeLabels[pathname]) return routeLabels[pathname]
  // Prefix match (for nested routes)
  for (const [key, label] of Object.entries(routeLabels)) {
    if (pathname.startsWith(key + '/')) return label
  }
  return 'ProspectMed'
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'US'
}

interface TopbarProps {
  leadsHoje?: number
}

export default function Topbar({ leadsHoje = 0 }: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [userInfo, setUserInfo] = useState<{
    name: string | null
    email: string | null
  }>({ name: null, email: null })

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUserInfo({
          name: data.user.user_metadata?.nome ?? data.user.user_metadata?.full_name ?? null,
          email: data.user.email ?? null,
        })
      }
    }
    loadUser()
  }, [supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const pageLabel = getPageLabel(pathname)

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-border shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">ProspectMed</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
        <span className="font-medium text-foreground">{pageLabel}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Leads counter badge */}
        <Badge
          variant="secondary"
          className="h-7 px-2.5 text-xs font-medium gap-1.5 bg-accent text-primary border-0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
          {leadsHoje}/12 leads hoje
        </Badge>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          title="Notificações"
        >
          <Bell className="w-4 h-4" />
        </Button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials(userInfo.name, userInfo.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {/* User info header */}
            <div className="px-3 py-2">
              {userInfo.name && (
                <p className="text-sm font-medium text-foreground truncate">
                  {userInfo.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate">
                {userInfo.email ?? '...'}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/configuracoes" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
