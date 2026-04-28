'use client'

import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { useAuth } from '@/hooks/use-auth'
import { useBlingStatus } from '@/hooks/use-bling-status'
import { ROUTES } from '@/lib/constants'
import { Perfil, StatusConexao } from '@/types'
import Link from 'next/link'

interface ConfigCard {
  title: string
  description: string
  href: string
  icon: string
  perfis: Perfil[]
}

const CARDS: ConfigCard[] = [
  {
    title: 'Conexão Bling',
    description: 'Integre com o Bling ERP para importar pedidos e sincronizar dados.',
    href: ROUTES.CONFIG_BLING,
    icon: '🔗',
    perfis: [Perfil.ADMIN],
  },
  {
    title: 'Regras de SKU',
    description: 'Configure os padrões de geração automática de códigos SKU.',
    href: ROUTES.CONFIG_SKU,
    icon: '🏷️',
    perfis: [Perfil.ADMIN],
  },
  {
    title: 'Campos Extras por Setor',
    description: 'Adicione campos personalizados por setor (Cabedal, Palmilha, Sola).',
    href: ROUTES.CONFIG_CAMPOS_EXTRAS,
    icon: '➕',
    perfis: [Perfil.ADMIN],
  },
  {
    title: 'Alterar Senha',
    description: 'Redefina sua senha de acesso ao sistema.',
    href: '/configuracoes/senha',
    icon: '🔑',
    perfis: [Perfil.ADMIN, Perfil.PCP, Perfil.PRODUCAO],
  },
]

// PCP herda a conexao Bling estabelecida pelo ADMIN: ve o status real em modo
// leitura, sem controles de connect/disconnect.
function BlingReadOnlyCard() {
  const { status, loading, configOk } = useBlingStatus()

  let label = 'Carregando...'
  let dotClass = 'bg-secondary/40'
  if (!loading) {
    if (!configOk) {
      label = 'Configuração incompleta'
      dotClass = 'bg-warning'
    } else if (status === StatusConexao.CONECTADO) {
      label = 'Conectado'
      dotClass = 'bg-success'
    } else if (status === StatusConexao.EXPIRADO) {
      label = 'Token expirado'
      dotClass = 'bg-warning'
    } else {
      label = 'Desconectado'
      dotClass = 'bg-secondary/40'
    }
  }

  return (
    <div
      data-testid="bling-readonly-card"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 opacity-90"
      aria-label="Conexão Bling — gerenciada pelo administrador"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">🔗</span>
        <span className="text-sm font-semibold text-foreground">Conexão Bling</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <p className="text-xs text-secondary leading-relaxed">
        Conexão gerenciada pelo administrador. Você usa a mesma integração para
        importar pedidos e sincronizar produtos.
      </p>
    </div>
  )
}

function ConfiguracoesContent({ perfil }: { perfil: Perfil }) {
  const cards = CARDS.filter((c) => c.perfis.includes(perfil))
  const showBlingReadOnly = perfil === Perfil.PCP
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="mt-0.5 text-sm text-secondary">Gerencie as configurações do sistema.</p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
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
        {showBlingReadOnly && <BlingReadOnlyCard />}
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
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
      <ConfiguracoesContent perfil={user.perfil as Perfil} />
    </SidebarLayout>
  )
}
