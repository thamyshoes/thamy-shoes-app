'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterBar } from '@/components/ui/filter-bar'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { usePedidos } from '@/hooks/use-pedidos'
import { formatDate } from '@/lib/format'
import { ROUTES } from '@/lib/constants'
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

const COLUMNS: Column<PedidoRow>[] = [
  { key: 'numero', header: 'Número', mono: true, sortable: true },
  {
    key: 'dataEmissao',
    header: 'Data Emissão',
    render: (p) => formatDate(p.dataEmissao),
    sortable: true,
  },
  { key: 'fornecedorNome', header: 'Fornecedor', sortable: true },
  { key: 'totalItens', header: 'Itens', align: 'right', sortable: true },
  {
    key: 'totalPendentes',
    header: 'Pendentes',
    align: 'center',
    render: (p) =>
      p.totalPendentes > 0 ? (
        <StatusBadge status="PENDENTE" size="sm" />
      ) : (
        <span className="text-xs text-secondary">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (p) => <StatusBadge status={p.status} />,
  },
]

export default function PedidosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<StatusPedido | undefined>(undefined)
  const [fornecedor, setFornecedor] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const { pedidos, total, loading, error, refetch } = usePedidos({
    status,
    fornecedor: fornecedor || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
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
                onClick={() => router.push(ROUTES.PEDIDOS_IMPORTAR)}
              >
                Importar
              </Button>
            )}
          </div>
        </div>

        <FilterBar>
          <label className="text-sm text-secondary">Status:</label>
          <select
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Buscar fornecedor"
            value={fornecedor}
            onChange={(e) => {
              setFornecedor(e.target.value)
              setPage(1)
            }}
          />

          <label className="text-sm text-secondary">De:</label>
          <input
            type="date"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={dataInicio}
            onChange={(e) => {
              setDataInicio(e.target.value)
              setPage(1)
            }}
          />

          <label className="text-sm text-secondary">Até:</label>
          <input
            type="date"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={dataFim}
            onChange={(e) => {
              setDataFim(e.target.value)
              setPage(1)
            }}
          />
        </FilterBar>

        <DataTable
          data={pedidos as PedidoRow[]}
          columns={COLUMNS}
          loading={loading}
          emptyMessage="Nenhum pedido importado"
          emptyAction={
            isAdmin
              ? {
                  label: 'Importar primeiro pedido',
                  onClick: () => router.push(ROUTES.PEDIDOS_IMPORTAR),
                }
              : undefined
          }
          onRowClick={handleRowClick}
          pagination={{ page, pageSize: 20, total }}
          onPageChange={setPage}
        />
      </div>
    </SidebarLayout>
  )
}
