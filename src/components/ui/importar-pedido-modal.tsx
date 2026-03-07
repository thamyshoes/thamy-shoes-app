'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { useBlingStatus } from '@/hooks/use-bling-status'
import { formatDate, formatDateTime } from '@/lib/format'
import { API_ROUTES, MESSAGES } from '@/lib/constants'
import { StatusConexao } from '@/types'

interface PedidoBling {
  id: string
  idBling: number
  numero: string
  dataEmissao: string
  importado: boolean
  importadoEm: string | null
}

interface DuplicataInfo {
  id: string
  numero: string
  status: string
  createdAt: string
  fichasGeradas: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onImportado: (pedidoId: string) => void
}

function buildColumns(
  onImportar: (pedido: PedidoBling) => void,
  importingId: number | null,
): Column<PedidoBling>[] {
  return [
    { key: 'numero', header: 'Número', mono: true },
    {
      key: 'dataEmissao',
      header: 'Data',
      render: (p) => formatDate(p.dataEmissao),
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'right',
      render: (p) => {
        const isImporting = importingId === p.idBling
        return (
          <Button
            variant="secondary"
            size="sm"
            disabled={p.importado || isImporting}
            onClick={(e) => {
              e.stopPropagation()
              onImportar(p)
            }}
          >
            {isImporting ? 'Importando...' : p.importado ? 'Importado' : 'Importar'}
          </Button>
        )
      },
    },
  ]
}

export function ImportarPedidoModal({ open, onClose, onImportado }: Props) {
  const { status: blingStatus, loading: blingLoading } = useBlingStatus()

  const [dias, setDias] = useState(7)
  const [pagina, setPagina] = useState(1)
  const [pedidos, setPedidos] = useState<PedidoBling[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)

  const [conflito, setConflito] = useState<DuplicataInfo | null>(null)
  const [pedidoConflito, setPedidoConflito] = useState<PedidoBling | null>(null)
  const [confirmandoConflito, setConfirmandoConflito] = useState(false)

  const isDesconectado = !blingLoading && blingStatus !== StatusConexao.CONECTADO

  const fetchPedidos = useCallback(async (d: number, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const raw = await fetch(`${API_ROUTES.BLING_PEDIDOS}?dias=${d}&pagina=${p}`, {
        credentials: 'include',
      })
      if (!raw.ok) {
        const body = (await raw.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? MESSAGES.ERROR.GENERIC)
      }
      const res = (await raw.json()) as { data: PedidoBling[]; pagina: number; hasMore: boolean }
      setPedidos(res.data)
      setHasMore(res.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && blingStatus === StatusConexao.CONECTADO) {
      void fetchPedidos(dias, pagina)
    }
  }, [open, dias, pagina, blingStatus, fetchPedidos])

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setPagina(1)
      setPedidos([])
      setError(null)
    }
  }, [open])

  function handleDiasChange(novosDias: number) {
    setDias(novosDias)
    setPagina(1)
  }

  async function handleImportar(pedido: PedidoBling) {
    setImportingId(pedido.idBling)
    try {
      const raw = await fetch(API_ROUTES.PEDIDOS_IMPORTAR, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idBling: pedido.idBling }),
      })
      const body = (await raw.json()) as { data?: { id: string }; pedido?: DuplicataInfo; error?: string }

      if (raw.status === 201) {
        const id = body.data?.id ?? ''
        toast.success(MESSAGES.SUCCESS.IMPORTED)
        onClose()
        onImportado(id)
      } else if (raw.status === 409 && body.pedido) {
        setConflito(body.pedido)
        setPedidoConflito(pedido)
      } else {
        toast.error(body.error ?? MESSAGES.ERROR.GENERIC)
      }
    } catch {
      toast.error(MESSAGES.ERROR.GENERIC)
    } finally {
      setImportingId(null)
    }
  }

  async function handleReimportar() {
    if (!pedidoConflito || !conflito) return
    setConfirmandoConflito(true)
    try {
      const raw = await fetch(`${API_ROUTES.PEDIDO_DETALHE(conflito.id)}/reimportar`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idBling: pedidoConflito.idBling }),
      })
      if (!raw.ok) {
        const body = (await raw.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? MESSAGES.ERROR.GENERIC)
      }
      toast.success(MESSAGES.SUCCESS.IMPORTED)
      setConflito(null)
      setPedidoConflito(null)
      onClose()
      onImportado(conflito.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setConfirmandoConflito(false)
    }
  }

  const columns = buildColumns(handleImportar, importingId)

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Importar Pedido"
        size="lg"
        footer={
          !isDesconectado ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPagina((p) => Math.max(p - 1, 1))}
                disabled={pagina === 1 || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-sm text-secondary">Página {pagina}</span>
              <button
                onClick={() => setPagina((p) => p + 1)}
                disabled={!hasMore || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {isDesconectado ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
              <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">Bling desconectado</p>
                <p className="mt-0.5 text-xs text-secondary">
                  Conecte o Bling nas configurações para importar pedidos.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="dias-select-modal" className="text-sm text-secondary">
                  Pedidos dos últimos:
                </label>
                <select
                  id="dias-select-modal"
                  value={dias}
                  onChange={(e) => handleDiasChange(Number(e.target.value))}
                  className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={3}>3 dias</option>
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>

              {error ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
                  <p className="text-sm text-danger">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void fetchPedidos(dias, pagina)}
                    className="mt-2"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <DataTable
                  data={pedidos}
                  columns={columns}
                  loading={loading}
                  emptyMessage={`Nenhum pedido encontrado nos últimos ${dias} dias`}
                />
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Modal de conflito (409) */}
      <Modal
        open={!!conflito}
        onClose={() => { setConflito(null); setPedidoConflito(null) }}
        title="Pedido já importado"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => { setConflito(null); setPedidoConflito(null) }}
            >
              Manter versão local
            </Button>
            <Button
              variant="primary"
              loading={confirmandoConflito}
              onClick={() => void handleReimportar()}
            >
              Atualizar dados
            </Button>
          </div>
        }
      >
        {conflito && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Pedido <span className="font-mono font-medium">{conflito.numero}</span> foi
              importado em{' '}
              <span className="font-medium">{formatDateTime(conflito.createdAt)}</span>.
            </p>
            {conflito.fichasGeradas && (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs text-warning">{MESSAGES.CONFIRM.REIMPORT}</p>
              </div>
            )}
            <p className="text-xs text-secondary">
              Deseja atualizar com os dados atuais do Bling ou manter a versão local?
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
