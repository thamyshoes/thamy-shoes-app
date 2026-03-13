'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Download, FileText, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { BotaoGerarFichas } from '@/components/pedidos/botao-gerar-fichas'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { SwatchCor } from '@/components/ui/swatch-cor'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { GradeTable } from '@/components/ui/grade-table'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { API_ROUTES, MESSAGES, ROUTES } from '@/lib/constants'
import { StatusItem, StatusPedido, Perfil } from '@/types'
import type { ItemPedido, FichaProducao, GradeRow } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemPedidoEnriquecido extends ItemPedido {
  corMapeada: boolean | null
  hex: string | null
}

interface PedidoDetalhe {
  id: string
  numero: string
  dataEmissao: string
  dataPrevista: string | null
  fornecedorNome: string
  observacoes: string | null
  status: StatusPedido
  itens: ItemPedidoEnriquecido[]
  fichas: FichaProducao[]
  grades: GradeRow[]
  totalItens: number
  totalPendentes: number
  temFacheta: boolean
}

// ── Colunas de Itens ─────────────────────────────────────────────────────────

function buildItemColumns(
  onEdit: (item: ItemPedidoEnriquecido) => void,
  canEditItems: boolean,
): Column<ItemPedidoEnriquecido>[] {
  return [
    { key: 'skuBruto', header: 'SKU Bruto', mono: true },
    {
      key: 'modelo',
      header: 'Modelo',
      render: (i) => i.modelo ?? <span className="text-secondary">—</span>,
    },
    {
      key: 'cor',
      header: 'Cor',
      render: (i) => (
        <span className="flex items-center gap-1.5 flex-wrap">
          {i.corMapeada && i.hex && <SwatchCor hex={i.hex} nome={i.corDescricao ?? i.cor ?? undefined} size="sm" />}
          <span>{i.corDescricao ?? i.cor ?? <span className="text-secondary">—</span>}</span>
          {i.corMapeada === false && i.cor && (
            <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
              cor não mapeada
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'tamanho',
      header: 'Tamanho',
      align: 'right',
      render: (i) =>
        i.tamanho != null ? String(i.tamanho) : <span className="text-secondary">—</span>,
    },
    { key: 'quantidade', header: 'Qtd', align: 'right' },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <StatusBadge status={i.status} size="sm" />,
    },
    ...(canEditItems
      ? [
          {
            key: 'acoes',
            header: '',
            render: (i: ItemPedidoEnriquecido) =>
              i.status === StatusItem.PENDENTE ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(i)
                  }}
                  className="rounded p-1 text-secondary hover:bg-muted hover:text-foreground"
                  aria-label="Editar item"
                  title="Editar item"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null,
          } as Column<ItemPedido>,
        ]
      : []),
  ]
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  pedidoId: string
  item: ItemPedidoEnriquecido | null
  onClose: () => void
  onSaved: () => void
}

function EditItemModal({ pedidoId, item, onClose, onSaved }: EditModalProps) {
  const [modelo, setModelo] = useState<string>('')
  const [cor, setCor] = useState('')
  const [corDescricao, setCorDescricao] = useState('')
  const [tamanho, setTamanho] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setModelo(item.modelo ?? '')
      setCor(item.cor ?? '')
      setCorDescricao(item.corDescricao ?? '')
      setTamanho(item.tamanho != null ? String(item.tamanho) : '')
    }
  }, [item])

  async function handleSave() {
    if (!item) return
    if (!modelo.trim()) { toast.error('Informe o modelo'); return }
    if (!cor.trim()) { toast.error('Informe o código da cor'); return }
    if (!tamanho.trim()) { toast.error('Informe o tamanho'); return }
    setSaving(true)
    try {
      await apiClient.put(
        `${API_ROUTES.PEDIDO_DETALHE(pedidoId)}/itens`,
        { itemId: item.id, modelo: modelo.trim(), cor: cor.trim(), corDescricao: corDescricao.trim(), tamanho: tamanho.trim() },
      )
      toast.success('Item resolvido')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Editar Item"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
            Salvar
          </Button>
        </div>
      }
    >
      {item && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">SKU Bruto</label>
            <p className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {item.skuBruto ?? '—'}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              Modelo <span className="text-danger">*</span>
            </label>
            <input
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ex: REF001"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              Código Cor <span className="text-danger">*</span>
            </label>
            <input
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="Ex: PT"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Cor Descrição</label>
            <input
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={corDescricao}
              onChange={(e) => setCorDescricao(e.target.value)}
              placeholder="Ex: Preto"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              Tamanho <span className="text-danger">*</span>
            </label>
            <input
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
              placeholder="Ex: 38"
              type="number"
              min={1}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PedidoDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { user, loading: authLoading } = useAuth()

  const [pedido, setPedido] = useState<PedidoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingItem, setEditingItem] = useState<ItemPedidoEnriquecido | null>(null)
  const [reimportando, setReimportando] = useState(false)
  const [showReimportConfirm, setShowReimportConfirm] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [allResolved, setAllResolved] = useState(false)

  const fetchPedido = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<PedidoDetalhe>(API_ROUTES.PEDIDO_DETALHE(id))
      setPedido(res)
      setAllResolved(res.totalPendentes === 0 && res.totalItens > 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchPedido()
  }, [fetchPedido])

  async function handleReimportar() {
    if (!pedido) return
    setReimportando(true)
    try {
      await apiClient.post(`${API_ROUTES.PEDIDO_DETALHE(id)}/reimportar`, {})
      toast.success('Pedido reimportado com sucesso')
      void fetchPedido()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setReimportando(false)
    }
  }

  async function handleExcluir() {
    setExcluindo(true)
    try {
      await apiClient.delete(API_ROUTES.PEDIDO_DETALHE(id))
      toast.success(MESSAGES.SUCCESS.DELETED)
      router.push(ROUTES.PEDIDOS)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
      setExcluindo(false)
    }
  }

function handleItemSaved() {
    setEditingItem(null)
    void fetchPedido()
  }

  if (authLoading || !user) return null

  const isAdmin = user.perfil === Perfil.ADMIN
  const canEditItems = isAdmin || user.perfil === Perfil.PCP
  const canGerarFichas =
    pedido && pedido.status !== StatusPedido.FICHAS_GERADAS && pedido.totalPendentes === 0 && pedido.totalItens > 0

  const itemColumns = buildItemColumns((item) => setEditingItem(item), canEditItems)

  return (
    <SidebarLayout user={user}>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-secondary">
        <Link href={ROUTES.PEDIDOS} className="hover:text-foreground transition-colors">
          Pedidos
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">
          {pedido ? `Pedido #${pedido.numero}` : 'Carregando...'}
        </span>
      </nav>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Erro ao carregar pedido" description={error} onRetry={fetchPedido} />
      )}

      {!loading && !error && pedido && (
        <div className="space-y-6">
          {/* Info Card */}
          <div className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs text-secondary">Número</span>
                  <span className="font-mono font-medium">{pedido.numero}</span>
                </div>
                <div>
                  <span className="block text-xs text-secondary">Status</span>
                  <StatusBadge status={pedido.status} />
                </div>
                <div>
                  <span className="block text-xs text-secondary">Fornecedor</span>
                  <span>{pedido.fornecedorNome}</span>
                </div>
                <div>
                  <span className="block text-xs text-secondary">Data Emissão</span>
                  <span>{formatDate(pedido.dataEmissao)}</span>
                </div>
                {pedido.dataPrevista && (
                  <div>
                    <span className="block text-xs text-secondary">Data Prevista</span>
                    <span>{formatDate(pedido.dataPrevista)}</span>
                  </div>
                )}
                {pedido.observacoes && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="block text-xs text-secondary">Observações</span>
                    <span className="text-sm">{pedido.observacoes}</span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowReimportConfirm(true)}
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Reimportar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Alerta de pendentes */}
          {pedido.totalPendentes > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
              <p className="text-sm text-warning">
                {pedido.totalPendentes === 1
                  ? '1 item pendente de resolução'
                  : `${pedido.totalPendentes} itens pendentes de resolução`}
              </p>
            </div>
          )}

          {/* Alerta: todos resolvidos */}
          {allResolved && pedido.status !== StatusPedido.FICHAS_GERADAS && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3">
              <p className="text-sm text-success">
                Todos os itens resolvidos. Pode gerar fichas.
              </p>
            </div>
          )}

          {/* Grade de Numeração */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">Grade de Numeração</h2>
            <GradeTable grades={pedido.grades} />
          </section>

          {/* Botão Gerar Fichas */}
          {(isAdmin || user.perfil === Perfil.PCP) && canGerarFichas && (
            <BotaoGerarFichas
              pedidoId={pedido.id}
              temFacheta={pedido.temFacheta}
              onGerado={() => void fetchPedido()}
            />
          )}
          {(isAdmin || user.perfil === Perfil.PCP) && pedido.status === StatusPedido.FICHAS_GERADAS && (
            <span className="text-xs text-secondary">Fichas já foram geradas</span>
          )}
          {(isAdmin || user.perfil === Perfil.PCP) && !canGerarFichas && pedido.status !== StatusPedido.FICHAS_GERADAS && pedido.totalPendentes > 0 && (
            <span className="text-xs text-secondary">
              Resolva todos os itens pendentes para gerar fichas
            </span>
          )}

          {/* Itens */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Itens ({pedido.totalItens})
            </h2>
            <DataTable
              data={pedido.itens}
              columns={itemColumns}
              emptyMessage="Nenhum item encontrado"
            />
          </section>

          {/* Fichas geradas */}
          {pedido.fichas.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-foreground">
                Fichas Geradas ({pedido.fichas.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pedido.fichas.map((ficha) => (
                  <div
                    key={ficha.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="mb-3">
                      <p className="text-sm font-semibold capitalize text-foreground">
                        {ficha.setor.charAt(0) + ficha.setor.slice(1).toLowerCase()}
                      </p>
                      <p className="text-xs text-secondary">{ficha.totalPares} pares</p>
                      <p className="text-xs text-secondary">
                        {formatDate(ficha.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={API_ROUTES.FICHA_DOWNLOAD_V2(ficha.id)}
                        download
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                      <a
                        href={ficha.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        Imprimir
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal edição de item */}
      {pedido && (
        <EditItemModal
          pedidoId={pedido.id}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleItemSaved}
        />
      )}

      {/* Confirm reimportar */}
      <ConfirmDialog
        open={showReimportConfirm}
        onClose={() => setShowReimportConfirm(false)}
        title="Reimportar pedido?"
        description={MESSAGES.CONFIRM.REIMPORT}
        confirmLabel="Reimportar"
        variant="danger"
        loading={reimportando}
        onConfirm={() => void handleReimportar()}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Excluir pedido?"
        description={`O pedido #${pedido?.numero ?? ''} e todos os seus itens serão removidos permanentemente.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={excluindo}
        onConfirm={() => void handleExcluir()}
      />

    </SidebarLayout>
  )
}
