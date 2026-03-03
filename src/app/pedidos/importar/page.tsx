'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WifiOff, Search } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
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
  fornecedorNome: string
  totalItens: number
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
      header: 'Data Emissão',
      render: (p) => formatDate(p.dataEmissao),
    },
    {
      key: 'fornecedorNome',
      header: 'Fornecedor',
    },
    {
      key: 'totalItens',
      header: 'Itens',
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) =>
        p.importado ? (
          <StatusBadge status="IMPORTADO" />
        ) : (
          <StatusBadge status="DISPONIVEL" variant="info" />
        ),
    },
    {
      key: 'acao',
      header: 'Ação',
      render: (p) => (
        <Button
          variant="secondary"
          size="sm"
          disabled={p.importado || importingId === p.idBling}
          onClick={(e) => {
            e.stopPropagation()
            onImportar(p)
          }}
        >
          {importingId === p.idBling ? 'Importando...' : p.importado ? 'Importado' : 'Importar'}
        </Button>
      ),
    },
  ]
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ImportarPedidoPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { status: blingStatus, loading: blingLoading } = useBlingStatus()

  const [dias, setDias] = useState(7)
  const [pedidos, setPedidos] = useState<PedidoBling[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [numeroBusca, setNumeroBusca] = useState('')

  // Modal de conflito (409)
  const [conflito, setConflito] = useState<DuplicataInfo | null>(null)
  const [pedidoConflito, setPedidoConflito] = useState<PedidoBling | null>(null)
  const [confirmandoConflito, setConfirmandoConflito] = useState(false)

  // ── Carregar pedidos do Bling ───────────────────────────────────────────────

  const fetchPedidos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // apiClient unwraps { data } automatically
      const list = await apiClient.get<PedidoBling[]>(
        `${API_ROUTES.BLING_PEDIDOS}?dias=${dias}`,
      )
      setPedidos(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setLoading(false)
    }
  }, [dias])

  useEffect(() => {
    if (blingStatus === StatusConexao.CONECTADO) {
      void fetchPedidos()
    }
  }, [dias, blingStatus, fetchPedidos])

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

  const isDesconectado =
    !blingLoading && blingStatus !== StatusConexao.CONECTADO

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
                onChange={(e) => setDias(Number(e.target.value))}
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

        {/* Busca manual — sempre visível quando Bling offline */}
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
                  onClick={() => void fetchPedidos()}
                  className="mt-2"
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {!error && (
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
