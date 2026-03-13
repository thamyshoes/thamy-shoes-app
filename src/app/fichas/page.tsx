'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, Download, Eye, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { useFichas, type FichaRow } from '@/hooks/use-fichas'
import { formatDateInput, isValidDateInput, normalizeDateInput } from '@/lib/format'
import { API_ROUTES, SETOR_LABELS } from '@/lib/constants'
import type { Setor } from '@prisma/client'

const SETOR_OPTIONS = [
  { value: '', label: 'Todos os setores' },
  ...Object.entries(SETOR_LABELS).map(([value, label]) => ({ value, label })),
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCreatedAt(raw: string | Date): string {
  try {
    const d = typeof raw === 'string' ? parseISO(raw) : raw
    return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return String(raw)
  }
}

interface PedidoGroup {
  key: string
  label: string
  createdAt: string
  fichas: FichaRow[]
}

function groupByPedido(fichas: FichaRow[]): PedidoGroup[] {
  const map = new Map<string, PedidoGroup>()

  for (const f of fichas) {
    const key = f.consolidado
      ? `consolidado-${f.consolidado.id}`
      : `pedido-${f.pedidoId ?? f.id}`

    const label = f.consolidado
      ? `Consolidado (${f.consolidado.pedidos.length} pedidos)`
      : `Pedido #${f.pedido.numero}`

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        createdAt: typeof f.createdAt === 'string' ? f.createdAt : f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
        fichas: [],
      })
    }
    map.get(key)!.fichas.push(f)
  }

  return Array.from(map.values())
}

// ── Setor Row (Visualizar + Baixar) ──────────────────────────────────────────

function SetorRow({ ficha }: { ficha: FichaRow }) {
  const [downloading, setDownloading] = useState(false)
  const label = SETOR_LABELS[ficha.setor] ?? ficha.setor

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(API_ROUTES.FICHA_DOWNLOAD_V2(ficha.id))
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast.error(data.error ?? 'Erro ao baixar ficha')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ficha-${ficha.setor.toLowerCase()}-${ficha.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao baixar ficha. Tente novamente.')
    } finally {
      setDownloading(false)
    }
  }

  function handleVisualizar() {
    window.open(`${API_ROUTES.FICHA_DOWNLOAD_V2(ficha.id)}?inline=1`, '_blank')
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          icon={<Eye className="h-3.5 w-3.5" />}
          onClick={handleVisualizar}
          aria-label={`Visualizar ficha ${label}`}
        >
          Visualizar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={
            downloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />
          }
          onClick={handleDownload}
          disabled={downloading}
          aria-label={downloading ? 'Baixando...' : `Baixar ficha ${label}`}
        >
          {downloading ? 'Baixando...' : 'Baixar'}
        </Button>
      </div>
    </div>
  )
}

// ── Pedido Card ──────────────────────────────────────────────────────────────

function PedidoCard({ group }: { group: PedidoGroup }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">
          {group.label}
        </span>
        <span className="text-xs text-secondary">
          {formatCreatedAt(group.createdAt)}
        </span>
      </div>

      <div className="space-y-2">
        {group.fichas.map((f) => (
          <SetorRow key={f.id} ficha={f} />
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PedidoCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="mb-3 flex justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/20" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-muted-foreground/10" />
        ))}
      </div>
    </div>
  )
}

// ── Inner content ─────────────────────────────────────────────────────────────

function FichasContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
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

  const groups = groupByPedido(fichas)

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
            {total} ficha{total !== 1 ? 's' : ''} em {groups.length} pedido{groups.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
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

      {/* Grid de cards por pedido */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="list" aria-label="Fichas geradas">
          {Array.from({ length: 4 }).map((_, i) => (
            <PedidoCardSkeleton key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Nenhuma ficha encontrada.</p>
          <p className="mt-1 text-xs text-secondary">
            Ajuste os filtros ou gere fichas primeiro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="list" aria-label="Fichas geradas">
          {groups.map((group) => (
            <PedidoCard key={group.key} group={group} />
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
