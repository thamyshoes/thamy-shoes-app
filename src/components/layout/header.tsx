'use client'

import { LogOut, Menu } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { MESSAGES, API_ROUTES, ROUTES } from '@/lib/constants'
import { Perfil, type UserSession } from '@/types'

const PERFIL_LABEL: Record<Perfil, string> = {
  [Perfil.ADMIN]: 'Administrador',
  [Perfil.PCP]: 'PCP',
  [Perfil.PRODUCAO]: 'Produção',
}

interface HeaderProps {
  user: UserSession
  onMenuClick?: () => void
  className?: string
}

export function Header({ user, onMenuClick, className }: HeaderProps) {
  async function handleLogout() {
    try {
      await fetch(API_ROUTES.AUTH_LOGOUT, { method: 'POST', credentials: 'include' })
      window.location.href = ROUTES.LOGIN
    } catch {
      toast.error(MESSAGES.ERROR.GENERIC)
    }
  }

  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-border bg-background px-4 gap-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-md p-1.5 text-secondary hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-sm font-medium text-foreground">{user.nome}</span>
          <span className="text-xs text-secondary">{PERFIL_LABEL[user.perfil]}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-secondary hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </header>
  )
}
