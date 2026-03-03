'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterBar } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { useFichas, type FichaRow } from '@/hooks/use-fichas'
import { formatDate } from '@/lib/format'
import { API_ROUTES, ROUTES } from '@/lib/constants'
import { Setor } from '@/types'

const SETOR_LABELS: Record<Setor, string> = {
  [Setor.CABEDAL]: 'Cabedal',
  [Setor.PALMILHA]: 'Palmilha',
  [Setor.SOLA]: 'Sola',
}

const SETOR_OPTIONS = [
  { value: '', label: 'Todos os setores' },
  { value: Setor.CABEDAL, label: 'Cabedal' },
  { value: Setor.PALMILHA, label: 'Palmilha' },
  { value: Setor.SOLA, label: 'Sola' },
]

const COLUMNS: Column<FichaRow>[] = [
  {
    key: 'pedido',
    header: 'Pedido',
    mono: true,
    sortable: true,
    render: (f) =>
      f.consolidado ? (
        <div
          className="flex items-center gap-1.5"
          title={`Pedidos: ${f.consolidado.pedidos.map((p) => p.pedido.numero).join(', ')}`}
        >
          <span>Consolidado</span>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            ★
          </span>
        </div>
      ) : (
        f.pedido.numero
      ),
  },
  {
    key: 'fornecedorNome',
    header: 'Fornecedor',
    sortable: true,
    render: (f) => (f.consolidado ? <span className="text-secondary">Múltiplos</span> : f.pedido.fornecedorNome),
  },
  {
    key: 'setor',
    header: 'Setor',
    render: (f) => <StatusBadge status={f.setor} size="sm" />,
  },
  {
    key: 'totalPares',
    header: 'Total Pares',
    align: 'right',
    sortable: true,
  },
  {
    key: 'createdAt',
    header: 'Data',
    sortable: true,
    render: (f) => formatDate(f.createdAt),
  },
  {
    key: 'id',
    header: 'Ações',
    align: 'right',
    render: (f) => (
      <div className="flex items-center justify-end gap-2">
        <a
          href={API_ROUTES.FICHA_DOWNLOAD(f.id)}
          download
          className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
          aria-label={`Baixar ficha ${f.consolidado ? 'consolidada' : f.pedido.numero} - ${f.setor}`}
        >
          Download
        </a>
        {f.pdfUrl && (
          <>
            <span className="text-border" aria-hidden>|</span>
            <a
              href={f.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
              aria-label={`Imprimir ficha ${f.consolidado ? 'consolidada' : f.pedido.numero} - ${f.setor}`}
            >
              Imprimir
            </a>
          </>
        )}
      </div>
    ),
  },
]

// ── Inner component (usa useSearchParams → precisa de Suspense no pai) ────────

function FichasContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const isProducao = user.perfil === 'PRODUCAO'

  // Inicializar filtros a partir da URL
  const [setor, setSetor] = useState<Setor | undefined>(
    (searchParams.get('setor') as Setor) || undefined,
  )
  const [dataInicio, setDataInicio] = useState(searchParams.get('dataInicio') ?? '')
  const [dataFim, setDataFim] = useState(searchParams.get('dataFim') ?? '')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [page, setPage] = useState(1)

  // PRODUCAO: usa o setor do usuário
  const setorEfetivo = isProducao && user.setor ? (user.setor as Setor) : setor

  const { fichas, total, totalPages, loading, error, refetch } = useFichas({
    setor: setorEfetivo,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    search: search || undefined,
    page,
  })

  // Resetar página ao mudar filtros
  useEffect(() => { setPage(1) }, [setor, dataInicio, dataFim, search])

  // Deep linking: atualizar URL
  function pushUrl(overrides: {
    setor?: Setor | undefined | null
    dataInicio?: string
    dataFim?: string
    search?: string
  }) {
    const s = 'setor' in overrides ? overrides.setor : setor
    const di = 'dataInicio' in overrides ? overrides.dataInicio : dataInicio
    const df = 'dataFim' in overrides ? overrides.dataFim : dataFim
    const q = 'search' in overrides ? overrides.search : search

    const params = new URLSearchParams()
    if (s) params.set('setor', s)
    if (di) params.set('dataInicio', di)
    if (df) params.set('dataFim', df)
    if (q) params.set('search', q)

    const qs = params.toString()
    router.replace(qs ? `${ROUTES.FICHAS}?${qs}` : ROUTES.FICHAS)
  }

  if (error) {
    return <ErrorState title="Erro ao carregar fichas" description={error} onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Central de Fichas</h1>
        {!loading && (
          <p className="mt-1 text-sm text-secondary">
            {total} ficha{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Filtros */}
      <FilterBar>
        {/* Setor */}
        <label className="text-sm text-secondary" htmlFor="filtro-setor">Setor:</label>
        {isProducao && user.setor ? (
          <>
            <select
              id="filtro-setor"
              disabled
              className="cursor-not-allowed rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground opacity-60"
              value={user.setor}
              onChange={() => {}}
              aria-label="Setor fixo para seu perfil"
            >
              <option value={user.setor}>{SETOR_LABELS[user.setor as Setor]}</option>
            </select>
            <span className="text-xs text-secondary">
              Mostrando fichas do setor{' '}
              {SETOR_LABELS[user.setor as Setor] ?? user.setor}
            </span>
          </>
        ) : (
          <select
            id="filtro-setor"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={setor ?? ''}
            onChange={(e) => {
              const next = (e.target.value as Setor) || undefined
              setSetor(next)
              pushUrl({ setor: next })
            }}
          >
            {SETOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {/* Data início */}
        <label className="text-sm text-secondary" htmlFor="filtro-data-inicio">De:</label>
        <input
          id="filtro-data-inicio"
          type="date"
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          value={dataInicio}
          onChange={(e) => {
            setDataInicio(e.target.value)
            pushUrl({ dataInicio: e.target.value })
          }}
        />

        {/* Data fim */}
        <label className="text-sm text-secondary" htmlFor="filtro-data-fim">Até:</label>
        <input
          id="filtro-data-fim"
          type="date"
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          value={dataFim}
          onChange={(e) => {
            setDataFim(e.target.value)
            pushUrl({ dataFim: e.target.value })
          }}
        />

        {/* Busca */}
        <label className="text-sm text-secondary" htmlFor="filtro-search">Buscar:</label>
        <input
          id="filtro-search"
          type="search"
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Pedido ou fornecedor"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            pushUrl({ search: e.target.value })
          }}
        />
      </FilterBar>

      {/* Tabela */}
      <DataTable
        data={fichas}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nenhuma ficha gerada ainda"
        emptyAction={{ label: 'Ir para Pedidos', onClick: () => router.push(ROUTES.PEDIDOS) }}
      />

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            Anterior
          </Button>
          <span className="text-sm text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próxima página"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Page (wrapper com auth + Suspense) ────────────────────────────────────────

export default function FichasPage() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading || !user) return null

  return (
    <SidebarLayout user={user}>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <FichasContent user={user} />
      </Suspense>
    </SidebarLayout>
  )
}
