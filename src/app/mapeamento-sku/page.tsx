'use client'

import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES } from '@/lib/constants'
import Link from 'next/link'

interface ConfigCard {
  title: string
  description: string
  href: string
  icon: string
}

const CARDS: ConfigCard[] = [
  {
    title: 'Mapeamento de Cores',
    description: 'Mapeie códigos de cores internos para descrições padronizadas.',
    href: ROUTES.CONFIG_CORES,
    icon: '🎨',
  },
  {
    title: 'Grades de Numeração',
    description: 'Gerencie as grades de tamanhos e os modelos associados a cada grade.',
    href: ROUTES.CONFIG_GRADES,
    icon: '📏',
  },
  {
    title: 'Modelos',
    description: 'Cadastre os modelos de calçados com especificações de cabedal, sola e palmilha.',
    href: ROUTES.CONFIG_MODELOS,
    icon: '👟',
  },
]

export default function MapeamentoSkuPage() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" role="status" aria-label="Carregando" />
      </div>
    )
  }

  return (
    <SidebarLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mapeamento de SKU</h1>
          <p className="mt-0.5 text-sm text-secondary">Gerencie cores, grades de numeração e modelos de calçados.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{card.icon}</span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.title}
                </span>
              </div>
              <p className="text-sm text-secondary leading-relaxed">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </SidebarLayout>
  )
}
