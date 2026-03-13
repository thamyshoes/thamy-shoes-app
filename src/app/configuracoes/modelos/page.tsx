'use client'

import { useState, useEffect, useCallback } from 'react'
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
  linha: string | null
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

interface PreviewLinha {
  codigo: string
  nome: string
  cabedal: string
  sola: string
  palmilha: string
  valida: boolean
  erro?: string
}

function toModeloRow(m: ModeloApi): ModeloRow {
  return {
    id:               m.id,
    codigo:           m.codigo,
    nome:             m.nome,
    linha:            m.linha,
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

  // Modal importação em lote
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [csvTexto, setCsvTexto] = useState('')
  const [preview, setPreview] = useState<PreviewLinha[]>([])
  const [importing, setImporting] = useState(false)

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

  function gerarPreview(csv: string): PreviewLinha[] {
    return csv
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linha, i) => {
        const sep = linha.includes(';') ? ';' : ','
        const partes = linha.split(sep).map((p) => p.trim())
        const codigo = partes[0] ?? ''
        const nome = partes[1] ?? ''
        if (!codigo || !nome) {
          return { codigo, nome, cabedal: '', sola: '', palmilha: '', valida: false, erro: `Linha ${i + 1}: código e nome obrigatórios` }
        }
        return { codigo, nome, cabedal: partes[2] ?? '', sola: partes[3] ?? '', palmilha: partes[4] ?? '', valida: true }
      })
  }

  async function importar() {
    if (!csvTexto.trim()) { toast.error('Cole os dados antes de importar'); return }
    setImporting(true)
    try {
      const result = await apiClient.post<{ criados: number; atualizados: number; erros: string[] }>(
        `${API_ROUTES.MODELOS}/bulk-import`,
        { dados: csvTexto },
      )
      const msg = `${result.criados} criados, ${result.atualizados} atualizados${result.erros.length ? `, ${result.erros.length} erros` : ''}`
      toast.success(msg)
      setImportModalOpen(false)
      setCsvTexto('')
      setPreview([])
      await fetchModelos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar')
    } finally {
      setImporting(false)
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
          <Button variant="secondary" onClick={() => { setCsvTexto(''); setPreview([]); setImportModalOpen(true) }}>
            Importar Lote
          </Button>
          <Button onClick={() => { setModalMode('create'); setModalModelo(null); setModalOpen(true) }}>
            Novo Modelo
          </Button>
        </div>
      </div>

      {/* Busca */}
      <input
        type="search"
        placeholder="Buscar por código, nome, cabedal, sola, palmilha ou linha"
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

      {/* Modal importação em lote */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Modelos em Lote"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Cole os dados no formato:<br />
            <span className="font-mono text-xs">Código;Nome;Cabedal;Sola;Palmilha</span><br />
            Cabedal, Sola e Palmilha são opcionais. Separador: <span className="font-mono">;</span> ou <span className="font-mono">,</span>
          </p>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={8}
            placeholder={'607;Modelo 607;SANTORINE;100;100\n608;Modelo 608;SANTORINE;100;100'}
            value={csvTexto}
            onChange={(e) => { setCsvTexto(e.target.value); setPreview([]) }}
            aria-label="Dados dos modelos"
          />
          <Button variant="secondary" onClick={() => setPreview(gerarPreview(csvTexto))}>
            Pré-visualizar ({csvTexto.split('\n').filter((l) => l.trim()).length} linhas)
          </Button>

          {preview.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Código</th>
                    <th className="px-2 py-1 text-left">Nome</th>
                    <th className="px-2 py-1 text-left">Cabedal</th>
                    <th className="px-2 py-1 text-left">Sola</th>
                    <th className="px-2 py-1 text-left">Palmilha</th>
                    <th className="px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} className={!p.valida ? 'bg-destructive/5' : ''}>
                      <td className="px-2 py-1 font-mono">{p.codigo || '—'}</td>
                      <td className="px-2 py-1">{p.nome || '—'}</td>
                      <td className="px-2 py-1 text-secondary">{p.cabedal || '—'}</td>
                      <td className="px-2 py-1 text-secondary">{p.sola || '—'}</td>
                      <td className="px-2 py-1 text-secondary">{p.palmilha || '—'}</td>
                      <td className={`px-2 py-1 ${p.valida ? 'text-success' : 'text-destructive'}`}>
                        {p.valida ? 'Válido' : p.erro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setImportModalOpen(false)}>Cancelar</Button>
            <Button onClick={importar} disabled={importing || !csvTexto.trim()}>
              {importing ? 'Importando…' : 'Importar'}
            </Button>
          </div>
        </div>
      </Modal>

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
