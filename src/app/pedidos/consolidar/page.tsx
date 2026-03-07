'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterBar } from '@/components/ui/filter-bar'
import { GradeTable } from '@/components/ui/grade-table'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { usePedidos } from '@/hooks/use-pedidos'
import { apiClient } from '@/lib/api-client'
import { formatDate, isValidDateInput, normalizeDateInput } from '@/lib/format'
import { API_ROUTES, MESSAGES, ROUTES } from '@/lib/constants'
import { StatusPedido } from '@/types'
import type { PedidoCompra, GradeRow } from '@/types'

type PedidoRow = PedidoCompra & { totalItens: number; totalPendentes: number }

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: StatusPedido.IMPORTADO, label: 'Importado' },
  { value: StatusPedido.PENDENTE_AJUSTE, label: 'Pendente Ajuste' },
  { value: StatusPedido.FICHAS_GERADAS, label: 'Fichas Geradas' },
]

type PedidoRowExt = PedidoRow & { selecionado: boolean }

function buildColumns(
  onImprimir: (pedidoId: string) => void,
  gerandoFichaId: string | null,
): Column<PedidoRowExt>[] {
  return [
    {
      key: 'selecionado',
      header: '',
      render: (p) => (
        <input
          type="checkbox"
          checked={p.selecionado}
          onChange={() => {}}
          className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          aria-label={`Selecionar pedido ${p.numero}`}
        />
      ),
    },
    { key: 'numero', header: 'Número', mono: true, sortable: true },
    {
      key: 'dataEmissao',
      header: 'Data Emissão',
      render: (p) => formatDate(p.dataEmissao),
      sortable: true,
    },
    { key: 'totalItens', header: 'Itens', align: 'right', sortable: true },
    {
      key: 'id',
      header: '',
      align: 'right',
      render: (p) => {
        if (p.status === StatusPedido.FICHAS_GERADAS) {
          return (
            <Link
              href={ROUTES.FICHAS}
              className="text-xs font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver fichas
            </Link>
          )
        }
        const isGerando = gerandoFichaId === p.id
        const pendente = p.totalPendentes > 0
        return (
          <Button
            variant="secondary"
            size="sm"
            loading={isGerando}
            disabled={pendente || isGerando}
            title={pendente ? 'Resolva os itens pendentes antes de imprimir' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              onImprimir(p.id)
            }}
          >
            Imprimir
          </Button>
        )
      },
    },
  ]
}

export default function ConsolidarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<StatusPedido | undefined>(undefined)
  const [fornecedor, setFornecedor] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [agruparPorFaixa, setAgruparPorFaixa] = useState(false)
  const [previewGrades, setPreviewGrades] = useState<GradeRow[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [gerandoFichaId, setGerandoFichaId] = useState<string | null>(null)

  const dataInicioFilter = isValidDateInput(dataInicio) ? dataInicio : undefined
  const dataFimFilter = isValidDateInput(dataFim) ? dataFim : undefined

  const { pedidos, loading, error, refetch } = usePedidos({
    status,
    fornecedor: fornecedor || undefined,
    dataInicio: dataInicioFilter,
    dataFim: dataFimFilter,
  })

  // ── Preview de grades quando 2+ pedidos selecionados ───────────────────────

  const fetchPreview = useCallback(async (ids: string[], porFaixa: boolean) => {
    if (ids.length < 2) {
      setPreviewGrades([])
      setPreviewTotal(0)
      return
    }
    setLoadingPreview(true)
    try {
      const params = new URLSearchParams()
      ids.forEach((id) => params.append('pedidoIds[]', id))
      if (porFaixa) params.set('agruparPorFaixa', 'true')
      const res = await apiClient.get<{ grades: GradeRow[]; totalPares: number }>(
        `${API_ROUTES.FICHAS_CONSOLIDAR}?${params.toString()}`,
      )
      setPreviewGrades(res.grades)
      setPreviewTotal(res.totalPares)
    } catch {
      setPreviewGrades([])
      setPreviewTotal(0)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  useEffect(() => {
    void fetchPreview(Array.from(selectedIds), agruparPorFaixa)
  }, [selectedIds, agruparPorFaixa, fetchPreview])

  // ── Toggle seleção de pedido ────────────────────────────────────────────────

  function toggleSelect(pedidoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(pedidoId)) {
        next.delete(pedidoId)
      } else {
        next.add(pedidoId)
      }
      return next
    })
  }

  // ── Gerar fichas consolidadas ───────────────────────────────────────────────

  async function handleGerar() {
    if (selectedIds.size < 2) {
      toast.error('Selecione pelo menos 2 pedidos para consolidar')
      return
    }
    setGerando(true)
    try {
      await apiClient.post(API_ROUTES.FICHAS_CONSOLIDAR, {
        pedidoIds: Array.from(selectedIds),
        agruparPorFaixa,
      })
      toast.success('Fichas consolidadas geradas com sucesso')
      router.push(ROUTES.FICHAS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar fichas consolidadas')
    } finally {
      setGerando(false)
      setShowConfirm(false)
    }
  }

  async function handleImprimir(pedidoId: string) {
    setGerandoFichaId(pedidoId)
    try {
      await apiClient.post(API_ROUTES.FICHAS_GERAR, { pedidoId })
      toast.success(MESSAGES.SUCCESS.FICHAS_GENERATED)
      router.push(ROUTES.FICHAS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setGerandoFichaId(null)
    }
  }

  if (authLoading || !user) return null

  if (error) {
    return (
      <SidebarLayout user={user}>
        <ErrorState title="Erro ao carregar pedidos" description={error} onRetry={refetch} />
      </SidebarLayout>
    )
  }

  const pedidoRows = (pedidos ?? []).map((p) => ({
    ...(p as PedidoRow),
    selecionado: selectedIds.has(p.id),
  }))
  const selectedCount = selectedIds.size
  const columns = buildColumns(handleImprimir, gerandoFichaId)

  return (
    <SidebarLayout user={user}>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-secondary">
        <Link href={ROUTES.PEDIDOS} className="hover:text-foreground transition-colors">
          Pedidos
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Gerar Ficha</span>
      </nav>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gerar Ficha</h1>
            {selectedCount > 0 && (
              <p className="mt-1 text-sm text-secondary">
                <span className="font-medium text-primary">{selectedCount} pedido{selectedCount !== 1 ? 's' : ''}</span>{' '}
                selecionado{selectedCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Button
            variant="primary"
            disabled={selectedCount < 2}
            loading={gerando}
            onClick={() => setShowConfirm(true)}
          >
            Gerar Fichas Consolidadas
          </Button>
        </div>

        {/* Filtros */}
        <FilterBar>
          <label className="text-sm text-secondary">Status:</label>
          <select
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={status ?? ''}
            onChange={(e) => setStatus((e.target.value as StatusPedido) || undefined)}
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
            onChange={(e) => setFornecedor(e.target.value)}
          />

          <label className="text-sm text-secondary">De:</label>
          <input
            type="text"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            pattern="\\d{2}/\\d{2}/\\d{4}"
            value={dataInicio}
            onChange={(e) => setDataInicio(normalizeDateInput(e.target.value))}
          />

          <label className="text-sm text-secondary">Até:</label>
          <input
            type="text"
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            pattern="\\d{2}/\\d{2}/\\d{4}"
            value={dataFim}
            onChange={(e) => setDataFim(normalizeDateInput(e.target.value))}
          />
        </FilterBar>

        {/* Instruções */}
        <p className="text-sm text-secondary">
          Clique em <strong>Imprimir</strong> na linha para gerar a ficha de um pedido individual.
          Para consolidar múltiplos pedidos numa única ficha, selecione-os e clique em <strong>Gerar Fichas Consolidadas</strong>.
        </p>

        {/* Tabela de pedidos com seleção */}
        <DataTable
          data={pedidoRows}
          columns={columns}
          loading={loading}
          emptyMessage="Nenhum pedido encontrado"
          onRowClick={(p) => toggleSelect(p.id)}
        />

        {/* Preview de grades */}
        {selectedCount >= 2 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Grade Consolidada
              </h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-secondary">
                  <input
                    type="checkbox"
                    checked={agruparPorFaixa}
                    onChange={(e) => setAgruparPorFaixa(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                  Separar Infantil / Adulto
                </label>
                {!loadingPreview && previewTotal > 0 && (
                  <span className="text-sm text-secondary">Total: {previewTotal} pares</span>
                )}
              </div>
            </div>
            {loadingPreview ? (
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
            ) : previewGrades.length > 0 ? (
              <GradeTable grades={previewGrades} />
            ) : (
              <p className="text-sm text-secondary">
                Nenhum item resolvido nos pedidos selecionados
              </p>
            )}
          </section>
        )}
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Gerar fichas consolidadas?"
        description={`Serão geradas 3 fichas (Cabedal, Palmilha, Sola) consolidando ${selectedCount} pedidos — total estimado: ${previewTotal} pares.`}
        confirmLabel="Gerar Fichas"
        variant="default"
        loading={gerando}
        onConfirm={() => void handleGerar()}
      />
    </SidebarLayout>
  )
}
