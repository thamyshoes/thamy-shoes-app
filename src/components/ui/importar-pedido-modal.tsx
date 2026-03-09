'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, WifiOff, Search, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { useBlingStatus } from '@/hooks/use-bling-status'
import { formatDate, formatDateTime } from '@/lib/format'
import { API_ROUTES, MESSAGES, ROUTES } from '@/lib/constants'
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
  onNavegar?: (href: string) => void
}

type Ordenacao = 'recente' | 'antigo'

const PAGE_SIZE = 10

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

export function ImportarPedidoModal({ open, onClose, onImportado, onNavegar }: Props) {
  const { status: blingStatus, loading: blingLoading } = useBlingStatus()

  const [dias, setDias] = useState(7)
  const [todosPedidos, setTodosPedidos] = useState<PedidoBling[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)

  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recente')
  const [pagina, setPagina] = useState(1)

  const [conflito, setConflito] = useState<DuplicataInfo | null>(null)
  const [pedidoConflito, setPedidoConflito] = useState<PedidoBling | null>(null)
  const [confirmandoConflito, setConfirmandoConflito] = useState(false)

  const isDesconectado = !blingLoading && blingStatus !== StatusConexao.CONECTADO

  // Busca TODAS as páginas da API do Bling de uma vez
  const fetchTodosPedidos = useCallback(async (d: number) => {
    setLoading(true)
    setError(null)
    try {
      const todos: PedidoBling[] = []
      let pag = 1
      let continuar = true

      while (continuar) {
        const raw = await fetch(`${API_ROUTES.BLING_PEDIDOS}?dias=${d}&pagina=${pag}`, {
          credentials: 'include',
        })
        if (!raw.ok) {
          const body = (await raw.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? MESSAGES.ERROR.GENERIC)
        }
        const res = (await raw.json()) as { data: PedidoBling[]; pagina: number; hasMore: boolean }
        todos.push(...res.data)
        continuar = res.hasMore
        pag++
      }

      setTodosPedidos(todos)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && blingStatus === StatusConexao.CONECTADO) {
      void fetchTodosPedidos(dias)
    }
  }, [open, dias, blingStatus, fetchTodosPedidos])

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setPagina(1)
      setTodosPedidos([])
      setError(null)
      setBusca('')
      setOrdenacao('recente')
      setConflito(null)
      setPedidoConflito(null)
    }
  }, [open])

  // Filtrar, ordenar e paginar localmente
  const { pedidosPagina, totalFiltrados, totalPages } = useMemo(() => {
    let resultado = [...todosPedidos]

    // Filtro por busca
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      resultado = resultado.filter((p) => p.numero.toLowerCase().includes(termo))
    }

    // Ordenação
    resultado.sort((a, b) => {
      const dateCompare = a.dataEmissao.localeCompare(b.dataEmissao)
      const numCompare = Number(a.idBling) - Number(b.idBling)
      if (ordenacao === 'recente') {
        return dateCompare !== 0 ? -dateCompare : -numCompare
      }
      return dateCompare !== 0 ? dateCompare : numCompare
    })

    const total = resultado.length
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const start = (pagina - 1) * PAGE_SIZE
    const paginados = resultado.slice(start, start + PAGE_SIZE)

    return { pedidosPagina: paginados, totalFiltrados: total, totalPages: pages }
  }, [todosPedidos, busca, ordenacao, pagina])

  // Reset pagina quando busca ou ordenação muda
  useEffect(() => {
    setPagina(1)
  }, [busca, ordenacao])

  function handleDiasChange(novosDias: number) {
    setDias(novosDias)
    setPagina(1)
    setBusca('')
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
        // Marcar como importado localmente
        setTodosPedidos((prev) =>
          prev.map((p) => p.idBling === pedido.idBling ? { ...p, importado: true } : p),
        )
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
          !isDesconectado && totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPagina((p) => Math.max(p - 1, 1))}
                disabled={pagina === 1 || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-sm text-secondary">
                Página {pagina} de {totalPages}
                {totalFiltrados > 0 && (
                  <span className="ml-1 text-xs">({totalFiltrados} pedido{totalFiltrados !== 1 ? 's' : ''})</span>
                )}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(p + 1, totalPages))}
                disabled={pagina >= totalPages || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : !isDesconectado && totalFiltrados > 0 ? (
            <div className="flex items-center justify-center">
              <span className="text-sm text-secondary">
                {totalFiltrados} pedido{totalFiltrados !== 1 ? 's' : ''}
              </span>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {isDesconectado ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-medium text-foreground">Bling desconectado</p>
                  <p className="mt-0.5 text-xs text-secondary">
                    Conecte o Bling nas configurações para importar pedidos.
                  </p>
                </div>
              </div>
              {onNavegar && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-secondary" />
                    <p className="text-sm font-medium text-foreground">Pedido já importado?</p>
                  </div>
                  <p className="text-xs text-secondary">
                    Localize pedidos já importados diretamente na lista de pedidos.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { onClose(); onNavegar(ROUTES.PEDIDOS) }}
                  >
                    Ir para Pedidos
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Filtros: dias + busca + ordenação */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="dias-select-modal" className="text-sm text-secondary whitespace-nowrap">
                    Últimos:
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

                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" />
                  <input
                    type="search"
                    placeholder="Buscar nº pedido"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full rounded-md border border-border bg-white pl-8 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Buscar por número do pedido"
                  />
                </div>

                <button
                  onClick={() => setOrdenacao((o) => o === 'recente' ? 'antigo' : 'recente')}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                  title={ordenacao === 'recente' ? 'Mais recente primeiro' : 'Mais antigo primeiro'}
                >
                  <ArrowUpDown className="h-3.5 w-3.5 text-secondary" />
                  {ordenacao === 'recente' ? 'Recente' : 'Antigo'}
                </button>
              </div>

              {error ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
                  <p className="text-sm text-danger">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void fetchTodosPedidos(dias)}
                    className="mt-2"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <DataTable
                  data={pedidosPagina}
                  columns={columns}
                  loading={loading}
                  emptyMessage={
                    busca.trim()
                      ? `Nenhum pedido "${busca}" encontrado`
                      : `Nenhum pedido encontrado nos últimos ${dias} dias`
                  }
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
