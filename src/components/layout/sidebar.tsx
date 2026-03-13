'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layers, Package, FileText, Settings, Users, Tag } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ROUTES } from '@/lib/constants'
import { Perfil } from '@/types'

interface NavChild {
  label: string
  href: string
}

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  perfis: Perfil[]
  children?: NavChild[]
}

const SKU_CHILDREN: NavChild[] = [
  { label: 'Modelos',   href: ROUTES.CONFIG_MODELOS },
  { label: 'Cores',     href: ROUTES.CONFIG_CORES },
  { label: 'Numeração', href: ROUTES.CONFIG_GRADES },
]

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Importar Pedidos',
    href: ROUTES.PEDIDOS,
    icon: <Package className="h-4 w-4" />,
    perfis: [Perfil.ADMIN, Perfil.PCP],
  },
  {
    label: 'Gerar Ficha',
    href: ROUTES.PEDIDOS_CONSOLIDAR,
    icon: <Layers className="h-4 w-4" />,
    perfis: [Perfil.ADMIN, Perfil.PCP],
  },
  {
    label: 'Fichas Geradas',
    href: ROUTES.FICHAS,
    icon: <FileText className="h-4 w-4" />,
    perfis: [Perfil.ADMIN, Perfil.PCP, Perfil.PRODUCAO],
  },
  {
    label: 'Gestão de SKU',
    icon: <Tag className="h-4 w-4" />,
    perfis: [Perfil.ADMIN],
    children: SKU_CHILDREN,
  },
  {
    // Sub-navigation for /configuracoes is handled inside the page itself.
    // The following routes are accessible via tabs/links on /configuracoes:
    //   /configuracoes/bling        — integração com Bling ERP
    //   /configuracoes/campos-extras — campos extras de pedidos
    //   /configuracoes/sku           — regras de parser de SKU
    label: 'Configurações',
    href: ROUTES.CONFIGURACOES,
    icon: <Settings className="h-4 w-4" />,
    perfis: [Perfil.ADMIN],
  },
  {
    label: 'Gestão de Usuários',
    href: ROUTES.USUARIOS,
    icon: <Users className="h-4 w-4" />,
    perfis: [Perfil.ADMIN],
  },
]

const SKU_ROUTES = SKU_CHILDREN.map((c) => c.href)

interface SidebarProps {
  perfil: Perfil
  onNavigate?: () => void
}

export function Sidebar({ perfil, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.perfis.includes(perfil))

  function isItemActive(item: NavItem): boolean {
    if (item.children) {
      return item.children.some((c) => pathname.startsWith(c.href))
    }
    if (item.href === ROUTES.PEDIDOS) return pathname === item.href
    if (item.href === ROUTES.CONFIGURACOES) {
      return pathname.startsWith(ROUTES.CONFIGURACOES) &&
        !SKU_ROUTES.some((r) => pathname.startsWith(r))
    }
    return !!item.href && pathname.startsWith(item.href)
  }

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
            unoptimized
          />
          <span className="text-sm font-bold text-primary">Thamy Shoes</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const groupActive = isItemActive(item)

            if (item.children) {
              return (
                <li key={item.label}>
                  {/* Group header — não clicável */}
                  <div
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm',
                      groupActive ? 'font-semibold text-primary' : 'text-secondary',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </div>
                  {/* Sub-items */}
                  <ul className="mt-0.5 space-y-0.5">
                    {item.children.map((child) => {
                      const childActive = pathname.startsWith(child.href)
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              'flex items-center rounded-md py-1.5 pl-9 pr-3 text-sm transition-colors',
                              childActive
                                ? 'bg-muted font-semibold text-primary'
                                : 'text-secondary hover:bg-muted hover:text-foreground',
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href!}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    groupActive
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
