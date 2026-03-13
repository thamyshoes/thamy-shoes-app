'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, Download, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Sheet } from '@/components/ui/sheet'
import { useAuth } from '@/hooks/use-auth'
import { useFichas } from '@/hooks/use-fichas'
import { FichaCardWeb, type FichaWeb } from '@/components/fichas/ficha-card-web'
import { formatDateInput, isValidDateInput, normalizeDateInput } from '@/lib/format'
import { API_ROUTES, ROUTES, SETOR_LABELS } from '@/lib/constants'
import type { Setor } from '@prisma/client'

const SETOR_OPTIONS = [
  { value: '', label: 'Todos os setores' },
  ...Object.entries(SETOR_LABELS).map(([value, label]) => ({ value, label })),
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function FichaCardSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-lg border border-border bg-muted" />
  )
}

// ── Inner content ─────────────────────────────────────────────────────────────

function FichasContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const isProducao = user.perfil === 'PRODUCAO'

  // Filtros locais (aplicados ao clicar "Filtrar")
  const [setorInput, setSetorInput] = useState(
    isProducao && user.setor ? user.setor : (searchParams.get('setor') ?? ''),
  )
  const [pedidoInput, setPedidoInput] = useState(searchParams.get('search') ?? '')
  const [dataInput, setDataInput] = useState(
    formatDateInput(searchParams.get('dataInicio') ?? ''),
  )

  // Filtros aplicados (usados no hook)
  const [setorAplicado, setSetorAplicado] = useState(setorInput)
  const [pedidoAplicado, setPedidoAplicado] = useState(pedidoInput)
  const [dataAplicada, setDataAplicada] = useState(dataInput)
  const [page, setPage] = useState(1)
  const [fichaVisualizando, setFichaVisualizando] = useState<FichaWeb | null>(null)
  const [downloadingSheet, setDownloadingSheet] = useState(false)

  const setorEfetivo = (setorAplicado || undefined) as Setor | undefined
  const dataFiltro = isValidDateInput(dataAplicada) ? dataAplicada : undefined

  const { fichas, total, totalPages, loading, error, refetch } = useFichas({
    setor: setorEfetivo,
    dataInicio: dataFiltro,
    search: pedidoAplicado || undefined,
    page,
  })

  useEffect(() => { setPage(1) }, [setorAplicado, pedidoAplicado, dataAplicada])

  function aplicarFiltros() {
    setSetorAplicado(setorInput)
    setPedidoAplicado(pedidoInput)
    setDataAplicada(dataInput)
    setPage(1)
  }

  function limparFiltros() {
    setSetorInput(isProducao && user.setor ? user.setor : '')
    setPedidoInput('')
    setDataInput('')
    setSetorAplicado(isProducao && user.setor ? user.setor : '')
    setPedidoAplicado('')
    setDataAplicada('')
    setPage(1)
  }

  function handleVisualizar(ficha: FichaWeb) {
    setFichaVisualizando(ficha)
  }

  async function handleDownloadSheet() {
    if (!fichaVisualizando) return
    setDownloadingSheet(true)
    try {
      const res = await fetch(API_ROUTES.FICHA_DOWNLOAD_V2(fichaVisualizando.id))
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error
        if (res.status === 404) { toast.error('Ficha não encontrada'); return }
        toast.error(msg ?? 'Erro ao baixar ficha')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ficha-${fichaVisualizando.setor.toLowerCase()}-${fichaVisualizando.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao baixar ficha. Tente novamente.')
    } finally {
      setDownloadingSheet(false)
    }
  }

  // Mapear FichaRow para FichaWeb
  const fichasWeb: FichaWeb[] = fichas.map((f) => ({
    id: f.id,
    setor: f.setor,
    pedidoNumero: f.consolidado
      ? `Consolidado (${f.consolidado.pedidos.length})`
      : f.pedido.numero,
    createdAt: typeof f.createdAt === 'string' ? f.createdAt : f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    totalCards: f.totalPares,
  }))

  if (error) {
    return <ErrorState title="Erro ao carregar fichas" description={error} onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Central de Fichas</h1>
        {!loading && (
          <p className="mt-1 text-sm text-secondary" aria-live="polite">
            {total} ficha{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Setor */}
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary" htmlFor="filtro-setor">
            Setor
          </label>
          <select
            id="filtro-setor"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            value={setorInput}
            onChange={(e) => setSetorInput(e.target.value)}
            disabled={isProducao && !!user.setor}
            aria-label="Filtrar por setor"
          >
            {SETOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Pedido */}
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary" htmlFor="filtro-pedido">
            Pedido
          </label>
          <input
            id="filtro-pedido"
            type="text"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Buscar pedido..."
            value={pedidoInput}
            onChange={(e) => setPedidoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
            aria-label="Buscar por número de pedido"
          />
        </div>

        {/* Data — type="text" + máscara dd/mm/aaaa mantido intencionalmente.
           O input nativo type="date" usa formato ISO (aaaa-mm-dd) que é
           inconsistente com o padrão brasileiro. A máscara manual garante
           UX previsível e inputMode="numeric" ativa teclado numérico em mobile. */}
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary" htmlFor="filtro-data">
            Data
          </label>
          <input
            id="filtro-data"
            type="text"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={dataInput}
            onChange={(e) => setDataInput(normalizeDateInput(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>

        <Button onClick={aplicarFiltros}>Filtrar</Button>
        <Button variant="ghost" onClick={limparFiltros} aria-label="Limpar filtros">
          ✕
        </Button>
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list" aria-label="Fichas geradas">
          {Array.from({ length: 8 }).map((_, i) => (
            <FichaCardSkeleton key={i} />
          ))}
        </div>
      ) : fichasWeb.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Nenhuma ficha encontrada.</p>
          <p className="mt-1 text-xs text-secondary">
            Ajuste os filtros ou gere fichas primeiro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list" aria-label="Fichas geradas">
          {fichasWeb.map((ficha) => (
            <FichaCardWeb
              key={ficha.id}
              ficha={ficha}
              onVisualizar={handleVisualizar}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            ← Anterior
          </Button>
          <span className="text-sm text-secondary" aria-live="polite">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próxima página"
          >
            Próxima →
          </Button>
        </div>
      )}

      {/* Sheet de visualizacao */}
      <Sheet
        open={!!fichaVisualizando}
        onClose={() => setFichaVisualizando(null)}
        title={fichaVisualizando ? `Ficha ${fichaVisualizando.setor} — #${fichaVisualizando.pedidoNumero}` : undefined}
        footer={
          fichaVisualizando ? (
            <Button
              onClick={handleDownloadSheet}
              disabled={downloadingSheet}
              icon={
                downloadingSheet
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Download className="h-4 w-4" />
              }
            >
              {downloadingSheet ? 'Baixando...' : 'Baixar PDF'}
            </Button>
          ) : undefined
        }
      >
        {fichaVisualizando && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                  {fichaVisualizando.setor}
                </span>
                <span className="font-mono text-sm font-medium text-foreground">
                  #{fichaVisualizando.pedidoNumero}
                </span>
              </div>
              <p className="mb-1 text-xs text-secondary">
                {(() => {
                  try {
                    return format(parseISO(fichaVisualizando.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                  } catch {
                    return fichaVisualizando.createdAt
                  }
                })()}
              </p>
              <p className="text-sm text-foreground">
                {fichaVisualizando.totalCards} {fichaVisualizando.totalCards === 1 ? 'card' : 'cards'}
              </p>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FichasPage() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading || !user) return null

  return (
    <SidebarLayout user={user}>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <FichasContent user={user} />
      </Suspense>
    </SidebarLayout>
  )
}
