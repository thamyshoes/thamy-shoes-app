'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES, ROUTES } from '@/lib/constants'
import { toast } from 'sonner'
import { TabelaModelos, type ModeloRow } from '@/components/modelos/tabela-modelos'
import { ModalEdicaoModelo, type GradeOption } from '@/components/modelos/modal-edicao-modelo'
import { ModalVariantes, type VarianteRow } from '@/components/variantes/modal-variantes'

// ── Tipos da API ───────────────────────────────────────────────────────────────

interface VarianteCor {
  id: string
  corCodigo: string
  imagemUrl?: string | null
  corCabedal: string | null
  corSola: string | null
  corPalmilha: string | null
  corFacheta: string | null
}

interface ModeloApi {
  id: string
  codigo: string
  nome: string
  cabedal: string | null
  sola: string | null
  palmilha: string | null
  facheta: string | null
  materialCabedal: string | null
  materialSola: string | null
  materialPalmilha: string | null
  materialFacheta: string | null
  variantesCor: VarianteCor[]
  gradeAtual: { id: string; nome: string; tamanhoMin: number; tamanhoMax: number } | null
}

interface ListResponse {
  items: ModeloApi[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function toModeloRow(m: ModeloApi): ModeloRow {
  return {
    id:               m.id,
    codigo:           m.codigo,
    nome:             m.nome,
    gradeNome:        m.gradeAtual?.nome ?? null,
    gradeId:          m.gradeAtual?.id ?? null,
    cabedal:          m.cabedal,
    sola:             m.sola,
    palmilha:         m.palmilha,
    facheta:          m.facheta,
    materialCabedal:  m.materialCabedal,
    materialSola:     m.materialSola,
    materialPalmilha: m.materialPalmilha,
    materialFacheta:  m.materialFacheta,
    totalVariantes:   m.variantesCor.length,
  }
}

function toVarianteRow(v: VarianteCor): VarianteRow {
  return {
    id:         v.id,
    corCodigo:  v.corCodigo,
    imagemUrl:  v.imagemUrl ?? null,
    corCabedal: v.corCabedal,
    corSola:    v.corSola,
    corPalmilha: v.corPalmilha,
    corFacheta: v.corFacheta,
  }
}

// ── Content ───────────────────────────────────────────────────────────────────

function ModelosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [modelos, setModelos] = useState<ModeloApi[]>([])
  const [grades, setGrades] = useState<GradeOption[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10)
    return isNaN(p) || p < 1 ? 1 : p
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  // Modal criar/editar
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [modalModelo, setModalModelo] = useState<ModeloRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Modal variantes
  const [variantesOpen, setVariantesOpen] = useState(false)
  const [variantesModelo, setVariantesModelo] = useState<ModeloApi | null>(null)


  // Sync imagens do Bling
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ atual: number; produto: string } | null>(null)
  const syncAbortRef = useRef<AbortController | null>(null)

  // Confirm excluir
  const [confirmExcluir, setConfirmExcluir] = useState<ModeloRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchGrades = useCallback(async () => {
    try {
      const data = await apiClient.get<GradeOption[]>(API_ROUTES.GRADES)
      setGrades(data)
    } catch {
      // grades são opcionais — não bloquear a tela
    }
  }, [])

  const fetchModelos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (search) params.set('search', search)
      const data = await apiClient.get<ListResponse>(`${API_ROUTES.MODELOS}?${params.toString()}`)
      setModelos(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { void fetchGrades() }, [fetchGrades])
  useEffect(() => { void fetchModelos() }, [fetchModelos])

  // Sincronizar search e page com URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (page > 1) params.set('page', String(page))
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(newUrl, { scroll: false })
  // router e pathname são estáveis — incluir apenas os valores reativos necessários
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page])

  // Sincronizar variantesModelo após refresh
  useEffect(() => {
    if (variantesModelo) {
      const updated = modelos.find((m) => m.id === variantesModelo.id)
      if (updated) setVariantesModelo(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos])

  async function excluir() {
    if (!confirmExcluir) return
    setDeleting(true)
    try {
      await apiClient.delete(`${API_ROUTES.MODELOS}/${confirmExcluir.id}`)
      toast.success('Modelo excluído')
      setConfirmExcluir(null)
      await fetchModelos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  // ── Bulk import ─────────────────────────────────────────────────────────────


  function cancelSync() {
    syncAbortRef.current?.abort()
  }

  async function syncBling(dias?: number) {
    const abortController = new AbortController()
    syncAbortRef.current = abortController

    setSyncing(true)
    setSyncProgress(null)

    const totais = { criadas: 0, atualizadas: 0, modelosCriados: 0, semImagem: 0, imagensBaixadas: 0, erros: [] as string[] }
    const MAX_ERROS = 100
    let totalProcessados = 0

    const diasParam = dias ? `&dias=${dias}` : ''
    const doFetch = (url: string) =>
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
      })

    try {
      // 1. Info: descobrir se é full sync ou incremental
      setSyncProgress({ atual: 0, produto: 'Consultando Bling…' })
      const infoRes = await doFetch(`${API_ROUTES.VARIANTES_SYNC_BLING}?pagina=info${diasParam}`)
      if (!infoRes.ok) throw new Error(`Erro ${infoRes.status}`)
      const info = await infoRes.json() as { isFirstSync: boolean; desde: string }

      if (info.isFirstSync) {
        toast.info('Primeira sincronização — buscando produtos dos últimos dias.')
      }

      // 2. Paginar até hasMore=false
      let pagina = 1
      let hasMore = true

      while (hasMore) {
        if (abortController.signal.aborted) break

        setSyncProgress({
          atual: totalProcessados,
          produto: `Página ${pagina}…`,
        })

        const res = await doFetch(`${API_ROUTES.VARIANTES_SYNC_BLING}?pagina=${pagina}${diasParam}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)

        const result = await res.json()
        hasMore = result.hasMore
        totalProcessados += result.processados ?? 0
        pagina++

        totais.criadas += result.criadas
        totais.atualizadas += result.atualizadas
        totais.modelosCriados += result.modelosCriados ?? 0
        totais.semImagem += result.semImagem
        totais.imagensBaixadas += result.imagensBaixadas
        if (result.erros?.length && totais.erros.length < MAX_ERROS) {
          totais.erros.push(...result.erros.slice(0, MAX_ERROS - totais.erros.length))
        }
      }

      // 3. Limpar estado visual ANTES de chamadas finais
      setSyncing(false)
      setSyncProgress(null)
      syncAbortRef.current = null

      // 4. Marcar sync como concluída (sem abort signal — request independente)
      if (!abortController.signal.aborted) {
        await fetch(`${API_ROUTES.VARIANTES_SYNC_BLING}?pagina=done`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        }).catch(() => {})
      }

      // 5. Mostrar resultado amigável
      const teveMudanca = totais.modelosCriados > 0 || totais.criadas > 0 || totais.atualizadas > 0 || totais.imagensBaixadas > 0

      if (abortController.signal.aborted) {
        toast.info('Sincronização cancelada.')
      } else if (totais.erros.length > 0) {
        const partes: string[] = []
        if (teveMudanca) {
          if (totais.modelosCriados > 0) partes.push(`${totais.modelosCriados} modelo(s) novo(s)`)
          if (totais.criadas > 0) partes.push(`${totais.criadas} variante(s) nova(s)`)
        }
        partes.push(`${totais.erros.length} erro(s)`)
        toast.error(`Sincronizado com erros: ${partes.join(', ')}`)
      } else if (!teveMudanca) {
        toast.success(`Tudo sincronizado! ${totalProcessados} produto(s) verificado(s), nenhuma novidade.`)
      } else {
        const partes: string[] = []
        if (totais.modelosCriados > 0) partes.push(`${totais.modelosCriados} modelo(s) novo(s)`)
        if (totais.criadas > 0) partes.push(`${totais.criadas} variante(s) nova(s)`)
        if (totais.atualizadas > 0) partes.push(`${totais.atualizadas} atualizada(s)`)
        if (totais.imagensBaixadas > 0) partes.push(`${totais.imagensBaixadas} imagem(ns) importada(s)`)
        toast.success(`Sincronização concluída: ${partes.join(', ')}`)
      }

      // 6. Recarregar lista de modelos
      fetchModelos().catch(() => {})
    } catch (err) {
      // Limpar estado visual no catch também
      setSyncing(false)
      setSyncProgress(null)
      syncAbortRef.current = null

      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.info('Sincronização cancelada')
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar com Bling')
      }
    }
  }

  if (error) {
    return <ErrorState title="Erro ao carregar modelos" description={error} onRetry={fetchModelos} />
  }

  const rows = modelos.map(toModeloRow)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.MAPEAMENTO_SKU} className="hover:underline">Detalhes dos Produtos</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Modelos</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            Modelos
            {total > 0 && <span className="ml-2 text-sm font-normal text-secondary">{total} cadastrado{total !== 1 ? 's' : ''}</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          {syncing ? (
            <Button variant="destructive" onClick={cancelSync}>
              Cancelar
              <svg className="ml-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => void syncBling(5)}>
                Bling (5 dias)
              </Button>
              <Button variant="secondary" onClick={() => void syncBling(30)}>
                Bling (30 dias)
              </Button>
              <Button variant="secondary" onClick={() => void syncBling(-1)}>
                Bling (tudo)
              </Button>
            </>
          )}
          <Button onClick={() => { setModalMode('create'); setModalModelo(null); setModalOpen(true) }}>
            Novo Modelo
          </Button>
        </div>
      </div>

      {/* Busca */}
      <input
        type="search"
        placeholder="Buscar por código, nome, cabedal, sola ou palmilha"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Buscar modelos"
      />

      {/* Tabela */}
      <TabelaModelos
        modelos={rows}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(m) => { setModalMode('edit'); setModalModelo(m); setModalOpen(true) }}
        onDelete={(m) => setConfirmExcluir(m)}
        onAddFirst={() => { setModalMode('create'); setModalModelo(null); setModalOpen(true) }}
        onVerVariantes={(m) => {
          const api = modelos.find((x) => x.id === m.id)
          if (api) { setVariantesModelo(api); setVariantesOpen(true) }
        }}
      />

      {/* Modal criar/editar */}
      <ModalEdicaoModelo
        open={modalOpen}
        modelo={modalModelo}
        mode={modalMode}
        grades={grades}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); void fetchModelos() }}
      />

      {/* Modal variantes */}
      {variantesModelo && (
        <ModalVariantes
          open={variantesOpen}
          modeloCodigo={variantesModelo.codigo}
          modeloNome={variantesModelo.nome}
          modeloId={variantesModelo.id}
          initialVariantes={variantesModelo.variantesCor.map(toVarianteRow)}
          onClose={() => setVariantesOpen(false)}
          onSaved={() => { void fetchModelos() }}
        />
      )}


      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir modelo"
        description={`Excluir o modelo "${confirmExcluir?.codigo} — ${confirmExcluir?.nome}"?`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModelosPage() {
  const { user, loading: authLoading } = useAuth()
  if (authLoading || !user) return null
  return (
    <SidebarLayout user={user}>
      <ModelosContent />
    </SidebarLayout>
  )
}
