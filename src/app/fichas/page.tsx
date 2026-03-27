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
import { useFichas, type FichaRow, type FichaGroup } from '@/hooks/use-fichas'
import { formatDateInput, isValidDateInput, normalizeDateInput } from '@/lib/format'
import { API_ROUTES } from '@/lib/constants'

const ALL_SETORES = ['CABEDAL', 'PALMILHA', 'SOLA', 'FACHETA'] as const
type SetorKey = typeof ALL_SETORES[number]

const SETOR_LABEL: Record<SetorKey, string> = {
  CABEDAL: 'Cabedal',
  PALMILHA: 'Palmilha',
  SOLA: 'Sola',
  FACHETA: 'Facheta',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDt(raw: string | Date): { data: string; hora: string } {
  try {
    const d = typeof raw === 'string' ? parseISO(raw) : raw
    return {
      data: format(d, 'dd/MM/yyyy', { locale: ptBR }),
      hora: format(d, 'HH:mm', { locale: ptBR }),
    }
  } catch {
    return { data: String(raw), hora: '' }
  }
}

function getGroupLabel(group: FichaGroup): string {
  const first = group[0]
  if (first.consolidado) {
    const nums = first.consolidado.pedidos.map((p) => p.pedido.numero).join(', ')
    return `Consolidado (${nums})`
  }
  return first.pedido.numero
}

function getGroupCreatedAt(group: FichaGroup): string | Date {
  return group[0].createdAt
}

function findBySetor(group: FichaGroup, setor: string): FichaRow | undefined {
  return group.find((f) => f.setor === setor)
}

// ── Setor Cell Buttons ───────────────────────────────────────────────────────

function SetorActions({ ficha }: { ficha: FichaRow | undefined }) {
  const [downloading, setDownloading] = useState(false)

  if (!ficha) {
    return <span className="text-muted-foreground">—</span>
  }

  async function handleDownload() {
    if (!ficha) return
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
    if (!ficha) return
    window.open(`${API_ROUTES.FICHA_DOWNLOAD_V2(ficha.id)}?inline=1`, '_blank')
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        data-testid={`fichas-visualizar-button-${ficha.id}`}
        variant="secondary"
        size="sm"
        icon={<Eye className="h-3.5 w-3.5" />}
        onClick={handleVisualizar}
      >
        Visualizar
      </Button>
      <Button
        data-testid={`fichas-baixar-button-${ficha.id}`}
        variant="ghost"
        size="sm"
        icon={
          downloading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />
        }
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? 'Baixando...' : 'Baixar'}
      </Button>
    </div>
  )
}

// ── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  )
}

// ── Inner content ─────────────────────────────────────────────────────────────

function FichasContent({ user }: { user: { id: string; perfil: string; setores: string[]; nome: string; email: string } }) {
  const searchParams = useSearchParams()

  const isProducao = user.perfil === 'PRODUCAO'
  // Para PRODUCAO, mostrar apenas colunas dos setores atribuídos
  const setoresVisiveis = isProducao && user.setores.length > 0
    ? (user.setores as SetorKey[]).filter((s) => ALL_SETORES.includes(s))
    : [...ALL_SETORES]

  const [pedidoInput, setPedidoInput] = useState(searchParams.get('search') ?? '')
  const [dataInput, setDataInput] = useState(
    formatDateInput(searchParams.get('dataInicio') ?? ''),
  )

  const [pedidoAplicado, setPedidoAplicado] = useState(pedidoInput)
  const [dataAplicada, setDataAplicada] = useState(dataInput)
  const [page, setPage] = useState(1)

  const dataFiltro = isValidDateInput(dataAplicada) ? dataAplicada : undefined

  const { groups, total, totalPages, loading, error, refetch } = useFichas({
    dataInicio: dataFiltro,
    search: pedidoAplicado || undefined,
    page,
  })

  useEffect(() => { setPage(1) }, [pedidoAplicado, dataAplicada])

  function aplicarFiltros() {
    setPedidoAplicado(pedidoInput)
    setDataAplicada(dataInput)
    setPage(1)
  }

  function limparFiltros() {
    setPedidoInput('')
    setDataInput('')
    setPedidoAplicado('')
    setDataAplicada('')
    setPage(1)
  }

  if (error) {
    return <ErrorState title="Erro ao carregar fichas" description={error} onRetry={refetch} />
  }

  return (
    <div data-testid="fichas-page" className="space-y-6">
      {/* Header */}
      <div data-testid="fichas-header">
        <h1 className="text-xl font-semibold text-foreground">Central de Fichas</h1>
        {!loading && (
          <p className="mt-1 text-sm text-secondary" aria-live="polite">
            {total} pedido{total !== 1 ? 's' : ''} com fichas geradas
          </p>
        )}
      </div>

      {/* Filtros */}
      <div data-testid="fichas-filters" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary" htmlFor="filtro-pedido">
            Pedido
          </label>
          <input
            data-testid="fichas-filter-pedido-input"
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

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary" htmlFor="filtro-data">
            Data
          </label>
          <input
            data-testid="fichas-filter-data-input"
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

        <Button data-testid="fichas-filter-aplicar-button" onClick={aplicarFiltros}>Filtrar</Button>
        <Button data-testid="fichas-filter-limpar-button" variant="ghost" onClick={limparFiltros} aria-label="Limpar filtros">
          ✕
        </Button>
      </div>

      {/* Tabela */}
      <div data-testid="fichas-table-container" className="rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table data-testid="fichas-table" className="w-full table-fixed text-[13px]" aria-label="Fichas de produção" aria-busy={loading}>
            <colgroup>
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[75px]" />
              {setoresVisiveis.map((s) => <col key={s} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-secondary">Pedido</th>
                <th className="px-3 py-2 text-center font-medium text-secondary">Data</th>
                <th className="px-3 py-2 text-left font-medium text-secondary">Horário</th>
                {setoresVisiveis.map((s) => (
                  <th key={s} className="border-l-2 border-border px-3 py-2 text-center font-medium text-secondary">
                    {SETOR_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={3 + setoresVisiveis.length} />)}

              {!loading && groups.length === 0 && (
                <tr>
                  <td colSpan={3 + setoresVisiveis.length} className="px-4 py-12 text-center text-secondary">
                    <div className="flex flex-col items-center">
                      <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-foreground">Nenhuma ficha encontrada.</p>
                      <p className="mt-1 text-xs text-secondary">
                        Ajuste os filtros ou gere fichas primeiro.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && groups.map((group) => {
                const label = getGroupLabel(group)
                const { data, hora } = formatDt(getGroupCreatedAt(group))

                return (
                  <tr
                    key={group[0].id}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-3 py-3 font-mono text-foreground">{label}</td>
                    <td className="px-3 py-3 text-center text-foreground">{data}</td>
                    <td className="px-3 py-3 text-foreground">{hora}</td>
                    {setoresVisiveis.map((s) => (
                      <td key={s} className="border-l-2 border-border px-3 py-3">
                        <div className="flex justify-center">
                          <SetorActions ficha={findBySetor(group, s)} />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Página anterior"
            >
              Anterior
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
              Próximo
            </Button>
          </div>
        )}
      </div>
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
