'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { API_ROUTES, ROUTES, TIMING } from '@/lib/constants'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ProdutoCatalogo {
  id: string
  idBling: string
  codigo: string
  nome: string
  imagemUrl: string | null
  ativo: boolean
  totalItens: number
  createdAt: string
}

interface ListResponse {
  data: ProdutoCatalogo[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── SKU parser (lado cliente, apenas para exibição) ────────────────────────────

function parseSku(codigo: string): { referencia: string; cor: string; tamanho: string } | null {
  // SKU: ...referencia... + 3 dígitos cor + 2 dígitos tamanho
  if (codigo.length < 5) return null
  const tamanho = codigo.slice(-2)
  const cor = codigo.slice(-5, -2)
  const referencia = codigo.slice(0, -5)
  if (!/^\d+$/.test(tamanho) || !/^\d+$/.test(cor)) return null
  return { referencia, cor, tamanho }
}

// ── Colunas ───────────────────────────────────────────────────────────────────

const COLUMNS: Column<ProdutoCatalogo>[] = [
  {
    key: 'codigo',
    header: 'Código SKU',
    mono: true,
  },
  {
    key: 'nome',
    header: 'Nome',
    render: (p) => <span className="text-sm text-foreground">{p.nome}</span>,
  },
  {
    key: 'referencia',
    header: 'Referência',
    mono: true,
    render: (p) => {
      const parsed = parseSku(p.codigo)
      return parsed ? (
        <span className="text-sm font-mono text-foreground">{parsed.referencia || '—'}</span>
      ) : (
        <span className="text-sm text-secondary">—</span>
      )
    },
  },
  {
    key: 'cor',
    header: 'Cor',
    mono: true,
    render: (p) => {
      const parsed = parseSku(p.codigo)
      return parsed ? (
        <span className="text-sm font-mono text-foreground">{parsed.cor}</span>
      ) : (
        <span className="text-sm text-secondary">—</span>
      )
    },
  },
  {
    key: 'tamanho',
    header: 'Tam.',
    align: 'center' as const,
    render: (p) => {
      const parsed = parseSku(p.codigo)
      return parsed ? (
        <span className="text-sm font-mono text-foreground">{parsed.tamanho}</span>
      ) : (
        <span className="text-sm text-secondary">—</span>
      )
    },
  },
  {
    key: 'totalItens',
    header: 'Itens',
    align: 'right' as const,
    render: (p) =>
      p.totalItens > 0 ? (
        <span className="text-sm font-medium text-foreground">{p.totalItens}</span>
      ) : (
        <span className="text-sm text-secondary">0</span>
      ),
  },
]

// ── Página ────────────────────────────────────────────────────────────────────

export default function ProdutosCatalogoPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, TIMING.DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const fetchProdutos = useCallback(async (p: number, s: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '20' })
      if (s) params.set('search', s)
      const raw = await fetch(`${API_ROUTES.PRODUTOS}?${params.toString()}`, {
        credentials: 'include',
      })
      if (!raw.ok) {
        const body = (await raw.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Erro ao carregar produtos')
      }
      const res = (await raw.json()) as ListResponse
      setProdutos(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProdutos(page, debouncedSearch)
  }, [page, debouncedSearch, fetchProdutos])

  if (authLoading || !user) return null

  return (
    <SidebarLayout user={user}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Catálogo de Produtos</h1>
            <p className="mt-0.5 text-sm text-secondary">
              {total > 0 ? `${total} produto${total !== 1 ? 's' : ''} importado${total !== 1 ? 's' : ''}` : 'Produtos importados do Bling'}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push(ROUTES.PRODUTOS_IMPORTAR)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Importar do Bling
          </Button>
        </div>

        {/* Barra de busca */}
        <div>
          <input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Erro */}
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
            <p className="text-sm text-danger">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void fetchProdutos(page, debouncedSearch)}
              className="mt-2"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Tabela */}
        {!error && (
          <DataTable
            data={produtos}
            columns={COLUMNS}
            loading={loading}
            emptyMessage="Nenhum produto no catálogo"
            emptyAction={{
              label: 'Importar do Bling',
              onClick: () => router.push(ROUTES.PRODUTOS_IMPORTAR),
            }}
            pagination={{ page, pageSize: 20, total }}
            onPageChange={setPage}
          />
        )}
      </div>
    </SidebarLayout>
  )
}
