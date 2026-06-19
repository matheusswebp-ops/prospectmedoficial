'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Users,
  Globe,
  Settings,
  Stethoscope,
  LogOut,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/prospeccao', label: 'Prospecção', icon: Search },
  { href: '/crm', label: 'CRM / Leads', icon: Users },
  { href: '/landing-pages', label: 'Landing Pages', icon: Globe },
]

const settingsItems = [
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return 'US'
}

export default function Sidebar() {
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

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex flex-col w-[240px] shrink-0 h-screen bg-white border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
          <Stethoscope className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-[15px] font-bold text-primary tracking-tight">
          ProspectMed
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-3 pt-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive(href)
                ? 'bg-accent text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4 shrink-0',
                isActive(href) ? 'text-primary' : 'text-current'
              )}
            />
            {label}
          </Link>
        ))}
      </nav>

      {/* Settings section */}
      <div className="px-3 pt-4">
        <Separator className="mb-3" />
        <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Sistema
        </p>
        {settingsItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive(href)
                ? 'bg-accent text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4 shrink-0',
                isActive(href) ? 'text-primary' : 'text-current'
              )}
            />
            {label}
          </Link>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User profile + logout */}
      <div className="px-3 pb-4">
        <Separator className="mb-3" />
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {getInitials(userInfo.name, userInfo.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            {userInfo.name && (
              <span className="text-sm font-medium text-foreground truncate leading-tight">
                {userInfo.name}
              </span>
            )}
            <span className="text-xs text-muted-foreground truncate leading-tight">
              {userInfo.email ?? '...'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
