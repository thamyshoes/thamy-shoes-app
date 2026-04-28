'use client'

import { useState, useCallback, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useBlingStatus } from '@/hooks/use-bling-status'
import { formatDateTime } from '@/lib/format'
import { API_ROUTES, MESSAGES, ROUTES } from '@/lib/constants'
import { Perfil, StatusConexao } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProdutoBling {
  id: string           // idBling como string (requerido pelo DataTable)
  idBling: number
  nome: string
  codigo: string
  imagemUrl: string | null
  importado: boolean
  importadoEm: string | null
}

// ── Paginação ─────────────────────────────────────────────────────────────────

import { ChevronLeft, ChevronRight } from 'lucide-react'

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

// ── Colunas ───────────────────────────────────────────────────────────────────

function buildColumns(
  onImportar: (produto: ProdutoBling) => void,
  importingId: number | null,
): Column<ProdutoBling>[] {
  return [
    {
      key: 'codigo',
      header: 'Código',
      mono: true,
    },
    {
      key: 'nome',
      header: 'Nome',
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) =>
        p.importado ? (
          <div className="space-y-0.5">
            <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Importado
            </span>
            {p.importadoEm && (
              <p className="text-xs text-secondary">{formatDateTime(p.importadoEm)}</p>
            )}
          </div>
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

// ── Página ────────────────────────────────────────────────────────────────────

export default function ImportarProdutosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { status: blingStatus, loading: blingLoading } = useBlingStatus()

  const [pagina, setPagina] = useState(1)
  const [produtos, setProdutos] = useState<ProdutoBling[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)

  // ── Carregar produtos do Bling ──────────────────────────────────────────────

  const fetchProdutos = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const raw = await fetch(`${API_ROUTES.BLING_PRODUTOS}?pagina=${p}`, {
        credentials: 'include',
      })
      if (!raw.ok) {
        const body = (await raw.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? MESSAGES.ERROR.GENERIC)
      }
      const res = (await raw.json()) as { data: ProdutoBling[]; pagina: number; hasMore: boolean }
      setProdutos(res.data)
      setHasMore(res.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (blingStatus === StatusConexao.CONECTADO) {
      void fetchProdutos(pagina)
    }
  }, [pagina, blingStatus, fetchProdutos])

  // ── Importar produto ────────────────────────────────────────────────────────

  async function handleImportar(produto: ProdutoBling) {
    setImportingId(produto.idBling)
    try {
      const raw = await fetch(API_ROUTES.PRODUTOS_IMPORTAR, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idBling: produto.idBling,
          nome: produto.nome,
          codigo: produto.codigo,
          imagemUrl: produto.imagemUrl,
        }),
      })
      const body = (await raw.json()) as { error?: string }

      if (raw.status === 201) {
        toast.success(`Produto "${produto.codigo}" importado com sucesso`)
        // Marcar como importado na lista local sem recarregar
        setProdutos((prev) =>
          prev.map((p) =>
            p.idBling === produto.idBling
              ? { ...p, importado: true, importadoEm: new Date().toISOString() }
              : p,
          ),
        )
      } else {
        toast.error(body.error ?? MESSAGES.ERROR.GENERIC)
      }
    } catch {
      toast.error(MESSAGES.ERROR.GENERIC)
    } finally {
      setImportingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authLoading || !user) return null

  const isDesconectado = !blingLoading && blingStatus !== StatusConexao.CONECTADO
  const columns = buildColumns(handleImportar, importingId)

  return (
    <SidebarLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Catálogo de Produtos</h1>
            <p className="mt-1 text-sm text-secondary">
              Importe produtos do Bling para vincular aos SKUs dos pedidos de compra.
            </p>
          </div>
        </div>

        {/* Banner: Bling desconectado */}
        {isDesconectado && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Bling desconectado</p>
              {user.perfil === Perfil.ADMIN ? (
                <p className="mt-0.5 text-xs text-secondary">
                  Conecte o Bling nas{' '}
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.CONFIG_BLING)}
                    className="underline hover:text-foreground transition-colors"
                  >
                    configurações
                  </button>{' '}
                  para acessar o catálogo de produtos.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-secondary">
                  Solicite ao administrador para reconectar o Bling antes de
                  acessar o catálogo de produtos.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tabela de produtos */}
        {!isDesconectado && (
          <>
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
                <p className="text-sm text-danger">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void fetchProdutos(pagina)}
                  className="mt-2"
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {!error && (
              <div className="space-y-3">
                <DataTable
                  data={produtos}
                  columns={columns}
                  loading={loading}
                  emptyMessage="Nenhum produto ativo encontrado no Bling"
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
    </SidebarLayout>
  )
}
