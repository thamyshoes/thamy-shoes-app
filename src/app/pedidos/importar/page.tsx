'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WifiOff, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useBlingStatus } from '@/hooks/use-bling-status'
import { formatDate, formatDateTime } from '@/lib/format'
import { API_ROUTES, MESSAGES, ROUTES } from '@/lib/constants'
import { StatusConexao, StatusPedido } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PedidoBling {
  id: string
  idBling: number
  numero: string
  dataEmissao: string
  situacao: string
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

// ── Badge de situação ─────────────────────────────────────────────────────────

const SITUACAO_STYLES: Record<string, string> = {
  'Em aberto': 'bg-blue-50 text-blue-700 border-blue-200',
  'Atendido':  'bg-green-50 text-green-700 border-green-200',
  'Cancelado': 'bg-red-50 text-red-600 border-red-200',
}

function SituacaoBadge({ valor }: { valor: string }) {
  const style = SITUACAO_STYLES[valor] ?? 'bg-muted text-secondary border-border'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {valor}
    </span>
  )
}

const SITUACOES_BLOQUEADAS = new Set(['Cancelado', 'cancelado'])

// ── Colunas da Tabela ─────────────────────────────────────────────────────────

function buildColumns(
  onImportar: (pedido: PedidoBling) => void,
  importingId: number | null,
): Column<PedidoBling>[] {
  return [
    {
      key: 'numero',
      header: 'Número',
      mono: true,
    },
    {
      key: 'dataEmissao',
      header: 'Data',
      render: (p) => formatDate(p.dataEmissao),
    },
    {
      key: 'situacao',
      header: 'Situação',
      render: (p) => <SituacaoBadge valor={p.situacao} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) =>
        p.importado ? (
          <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            Importado
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-secondary">
            Disponível
          </span>
        ),
    },
    {
      key: 'acao',
      header: 'Ação',
      render: (p) => {
        const bloqueado = SITUACOES_BLOQUEADAS.has(p.situacao)
        const isImporting = importingId === p.idBling
        return (
          <Button
            variant="secondary"
            size="sm"
            disabled={p.importado || isImporting || bloqueado}
            title={bloqueado ? `Situação "${p.situacao}" não permite importação` : undefined}
            onClick={(e) => {
              e.stopPropagation()
              onImportar(p)
            }}
          >
            {isImporting ? 'Importando...' : p.importado ? 'Importado' : bloqueado ? 'Cancelado' : 'Importar'}
          </Button>
        )
      },
    },
  ]
}

// ── Paginação ─────────────────────────────────────────────────────────────────

function Paginacao({
  pagina,
  hasMore,
  onAnterior,
  onProxima,
  loading,
}: {
  pagina: number
  hasMore: boolean
  onAnterior: () => void
  onProxima: () => void
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-3">
      <button
        onClick={onAnterior}
        disabled={pagina === 1 || loading}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </button>
      <span className="text-sm text-secondary">Página {pagina}</span>
      <button
        onClick={onProxima}
        disabled={!hasMore || loading}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      >
        Próxima
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ImportarPedidoPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { status: blingStatus, loading: blingLoading } = useBlingStatus()

  const [dias, setDias] = useState(7)
  const [pagina, setPagina] = useState(1)
  const [pedidos, setPedidos] = useState<PedidoBling[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [numeroBusca, setNumeroBusca] = useState('')

  // Modal de conflito (409)
  const [conflito, setConflito] = useState<DuplicataInfo | null>(null)
  const [pedidoConflito, setPedidoConflito] = useState<PedidoBling | null>(null)
  const [confirmandoConflito, setConfirmandoConflito] = useState(false)

  // ── Carregar pedidos do Bling ───────────────────────────────────────────────

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
    if (blingStatus === StatusConexao.CONECTADO) {
      void fetchPedidos(dias, pagina)
    }
  }, [dias, pagina, blingStatus, fetchPedidos])

  function handleDiasChange(novosDias: number) {
    setDias(novosDias)
    setPagina(1)
  }

  // ── Importar pedido ────────────────────────────────────────────────────────

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
        router.push(ROUTES.PEDIDO_DETALHE(id))
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

  // ── Reimportar (atualizar) ─────────────────────────────────────────────────

  async function handleReimportar() {
    if (!pedidoConflito || !conflito) return
    setConfirmandoConflito(true)
    try {
      await apiClient.put(
        `${API_ROUTES.PEDIDO_DETALHE(conflito.id)}/reimportar`,
        { idBling: pedidoConflito.idBling },
      )
      toast.success(MESSAGES.SUCCESS.IMPORTED)
      setConflito(null)
      setPedidoConflito(null)
      router.push(ROUTES.PEDIDO_DETALHE(conflito.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setConfirmandoConflito(false)
    }
  }

  // ── Busca manual de pedido por número ─────────────────────────────────────

  function handleBuscaManual(e: React.FormEvent) {
    e.preventDefault()
    const num = numeroBusca.trim()
    if (!num) return
    router.push(`${ROUTES.PEDIDOS}?numero=${encodeURIComponent(num)}&status=${StatusPedido.IMPORTADO}`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authLoading || !user) return null

  const isDesconectado = !blingLoading && blingStatus !== StatusConexao.CONECTADO
  const columns = buildColumns(handleImportar, importingId)

  return (
    <SidebarLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Importar Pedido</h1>

          {!isDesconectado && (
            <div className="flex items-center gap-2">
              <label htmlFor="dias-select" className="text-sm text-secondary">
                Pedidos dos últimos:
              </label>
              <select
                id="dias-select"
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
          )}
        </div>

        {/* Banner: Bling desconectado */}
        {isDesconectado && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Bling desconectado</p>
              <p className="mt-0.5 text-xs text-secondary">
                A importação automática não está disponível. Conecte o Bling nas{' '}
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.CONFIG_BLING)}
                  className="underline hover:text-foreground transition-colors"
                >
                  configurações
                </button>{' '}
                para importar pedidos diretamente.
              </p>
            </div>
          </div>
        )}

        {/* Busca manual — quando Bling offline */}
        {isDesconectado && (
          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-secondary" />
              <h2 className="text-sm font-medium text-foreground">Buscar pedido já importado</h2>
            </div>
            <p className="text-xs text-secondary">
              Se o pedido já foi importado anteriormente, você pode localizá-lo pelo número.
            </p>
            <form onSubmit={handleBuscaManual} className="flex gap-2">
              <input
                type="text"
                value={numeroBusca}
                onChange={(e) => setNumeroBusca(e.target.value)}
                placeholder="Número do pedido"
                className="flex-1 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={!numeroBusca.trim()}>
                Buscar
              </Button>
            </form>
          </section>
        )}

        {/* Tabela de pedidos */}
        {!isDesconectado && (
          <>
            {error && (
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
            )}

            {!error && (
              <div className="space-y-3">
                <DataTable
                  data={pedidos}
                  columns={columns}
                  loading={loading}
                  emptyMessage={`Nenhum pedido encontrado nos últimos ${dias} dias`}
                />
                <Paginacao
                  pagina={pagina}
                  hasMore={hasMore}
                  onAnterior={() => setPagina((p) => Math.max(p - 1, 1))}
                  onProxima={() => setPagina((p) => p + 1)}
                  loading={loading}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de conflito (409) */}
      <Modal
        open={!!conflito}
        onClose={() => {
          setConflito(null)
          setPedidoConflito(null)
        }}
        title="Pedido já importado"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setConflito(null)
                setPedidoConflito(null)
              }}
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
    </SidebarLayout>
  )
}
