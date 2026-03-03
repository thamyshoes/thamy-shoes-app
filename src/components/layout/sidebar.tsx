'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layers, Package, Download, FileText, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ROUTES } from '@/lib/constants'
import { Perfil } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  perfis: Perfil[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Pedidos',
    href: ROUTES.PEDIDOS,
    icon: <Package className="h-4 w-4" />,
    perfis: [Perfil.ADMIN, Perfil.PCP],
  },
  {
    label: 'Importar',
    href: ROUTES.PEDIDOS_IMPORTAR,
    icon: <Download className="h-4 w-4" />,
    perfis: [Perfil.ADMIN],
  },
  {
    label: 'Consolidar',
    href: ROUTES.PEDIDOS_CONSOLIDAR,
    icon: <Layers className="h-4 w-4" />,
    perfis: [Perfil.ADMIN, Perfil.PCP],
  },
  {
    label: 'Central de Fichas',
    href: ROUTES.FICHAS,
    icon: <FileText className="h-4 w-4" />,
    perfis: [Perfil.ADMIN, Perfil.PCP, Perfil.PRODUCAO],
  },
  {
    label: 'Configurações',
    href: ROUTES.CONFIGURACOES,
    icon: <Settings className="h-4 w-4" />,
    perfis: [Perfil.ADMIN],
  },
  {
    label: 'Usuários',
    href: ROUTES.USUARIOS,
    icon: <Users className="h-4 w-4" />,
    perfis: [Perfil.ADMIN],
  },
]

interface SidebarProps {
  perfil: Perfil
  onNavigate?: () => void
}

export function Sidebar({ perfil, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.perfis.includes(perfil))

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href={ROUTES.PEDIDOS} className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Thamy Shoes"
            width={120}
            height={32}
            className="h-7 w-auto"
            priority
          />
          <span className="text-sm font-bold text-primary">Thamy Shoes</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const isActive =
              item.href === ROUTES.PEDIDOS
                ? pathname === item.href
                : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-muted font-semibold text-primary'
                      : 'text-secondary hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
