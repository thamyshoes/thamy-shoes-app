'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterBar } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { ImportarPedidoModal } from '@/components/ui/importar-pedido-modal'
import { useAuth } from '@/hooks/use-auth'
import { usePedidos } from '@/hooks/use-pedidos'
import { formatDate, isValidDateInput, normalizeDateInput } from '@/lib/format'
import { ROUTES, API_ROUTES } from '@/lib/constants'
import { StatusPedido, Perfil } from '@/types'
import type { PedidoCompra } from '@/types'

const isAdminOrPCP = (perfil: Perfil) => perfil === Perfil.ADMIN || perfil === Perfil.PCP

type PedidoRow = PedidoCompra & { totalItens: number; totalPendentes: number }

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: StatusPedido.IMPORTADO, label: 'Importado' },
  { value: StatusPedido.PENDENTE_AJUSTE, label: 'Pendente Ajuste' },
  { value: StatusPedido.FICHAS_GERADAS, label: 'Fichas Geradas' },
]

function BotaoGerarInline({ pedidoId, onGerado }: { pedidoId: string; onGerado: () => void }) {
  const [gerando, setGerando] = useState(false)
  const router = useRouter()

  async function handleGerar(e: React.MouseEvent) {
    e.stopPropagation()
    setGerando(true)
    try {
      const res = await fetch(API_ROUTES.FICHAS_GERAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast.error(data.error ?? 'Erro ao gerar fichas')
        return
      }
      const result = await res.json() as { data?: { fichas?: unknown[] }; avisos?: string[] }
      const count = result?.data?.fichas?.length ?? 0
      toast.success(count > 0 ? `${count} fichas geradas com sucesso` : 'Fichas geradas')
      if (result.avisos) {
        for (const aviso of result.avisos) toast.warning(aviso, { duration: 8000 })
      }
      onGerado()
      router.push(ROUTES.FICHAS)
    } catch {
      toast.error('Erro ao gerar fichas. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
      onClick={handleGerar}
      disabled={gerando}
    >
      {gerando ? 'Gerando...' : 'Gerar Fichas'}
    </Button>
  )
}

function buildColumns(
  canGerarFichas: boolean,
  onGerado: () => void,
): Column<PedidoRow>[] {
  const cols: Column<PedidoRow>[] = [
    { key: 'numero', header: 'Número', mono: true, sortable: true },
    {
      key: 'dataEmissao',
      header: 'Data Emissão',
      render: (p) => formatDate(p.dataEmissao),
      sortable: true,
    },
    { key: 'totalItens', header: 'Itens', align: 'right', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
  ]

  if (canGerarFichas) {
    cols.push({
      key: 'acoes',
      header: 'Ações',
      align: 'center',
      render: (p) => {
        const canGerar =
          p.totalPendentes === 0 &&
          p.totalItens > 0

        if (!canGerar) return null

        return <BotaoGerarInline pedidoId={p.id} onGerado={onGerado} />
      },
    })
  }

  return cols
}

export default function PedidosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [showImportar, setShowImportar] = useState(false)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<StatusPedido | undefined>(undefined)
  const [fornecedor, setFornecedor] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const dataInicioFilter = isValidDateInput(dataInicio) ? dataInicio : undefined
  const dataFimFilter = isValidDateInput(dataFim) ? dataFim : undefined

  const { pedidos, total, loading, error, refetch } = usePedidos({
    status,
    fornecedor: fornecedor || undefined,
    dataInicio: dataInicioFilter,
    dataFim: dataFimFilter,
    page,
  })

  const handleRowClick = useCallback(
    (pedido: PedidoRow) => {
      router.push(ROUTES.PEDIDO_DETALHE(pedido.id))
    },
    [router],
  )

  if (authLoading || !user) return null

  if (error) {
    return (
      <SidebarLayout user={user}>
        <ErrorState title="Erro ao carregar pedidos" description={error} onRetry={refetch} />
      </SidebarLayout>
    )
  }

  const isAdmin = user.perfil === Perfil.ADMIN
  const canConsolidar = isAdminOrPCP(user.perfil)
  const columns = buildColumns(canConsolidar, refetch)

  return (
    <SidebarLayout user={user}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Pedidos de Compra</h1>
          <div className="flex gap-2">
            {canConsolidar && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(ROUTES.PEDIDOS_CONSOLIDAR)}
              >
                Consolidar
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowImportar(true)}
              >
                Importar
              </Button>
            )}
          </div>
        </div>

        <FilterBar>
          <label className="text-sm text-secondary">Status:</label>
          <select
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={status ?? ''}
            onChange={(e) => {
              setStatus((e.target.value as StatusPedido) || undefined)
              setPage(1)
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="text-sm text-secondary">Fornecedor:</label>
          <input
            type="text"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Buscar fornecedor"
            value={fornecedor}
            onChange={(e) => {
              setFornecedor(e.target.value)
              setPage(1)
            }}
          />

          <label className="text-sm text-secondary">De:</label>
          <input
            type="text"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            pattern="\\d{2}/\\d{2}/\\d{4}"
            value={dataInicio}
            onChange={(e) => {
              setDataInicio(normalizeDateInput(e.target.value))
              setPage(1)
            }}
          />

          <label className="text-sm text-secondary">Até:</label>
          <input
            type="text"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            pattern="\\d{2}/\\d{2}/\\d{4}"
            value={dataFim}
            onChange={(e) => {
              setDataFim(normalizeDateInput(e.target.value))
              setPage(1)
            }}
          />
        </FilterBar>

        <DataTable
          data={pedidos as PedidoRow[]}
          columns={columns}
          loading={loading}
          emptyMessage="Nenhum pedido importado"
          emptyAction={
            isAdmin
              ? {
                  label: 'Importar primeiro pedido',
                  onClick: () => setShowImportar(true),
                }
              : undefined
          }
          onRowClick={handleRowClick}
          pagination={{ page, pageSize: 20, total }}
          onPageChange={setPage}
        />
      </div>
      <ImportarPedidoModal
        open={showImportar}
        onClose={() => setShowImportar(false)}
        onImportado={(id) => router.push(ROUTES.PEDIDO_DETALHE(id))}
        onNavegar={(href) => router.push(href)}
      />
    </SidebarLayout>
  )
}
