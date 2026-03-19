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

interface PreviewLinha {
  codigo: string
  modelo: string
  cor: string
  tamanho: string
  descricao: string
  valida: boolean
  erro?: string
}

interface ImportResult {
  modelosCriados: number
  modelosExistentes: number
  variantesCriadas: number
  linhasProcessadas: number
  linhasIgnoradas: number
  erros: string[]
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

  // Modal importação em lote
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [csvTexto, setCsvTexto] = useState('')
  const [preview, setPreview] = useState<PreviewLinha[]>([])
  const [importing, setImporting] = useState(false)

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

  function gerarPreview(csv: string): PreviewLinha[] {
    const linhas = csv.split('\n').map((l) => l.trim()).filter(Boolean)
    if (linhas.length === 0) return []

    // Strip BOM UTF-8 se presente
    linhas[0] = linhas[0]!.replace(/^\uFEFF/, '')
    const isBling = linhas[0]!.includes('\t') && /^(ID|id)\t/i.test(linhas[0]!)
    const startIdx = isBling ? 1 : 0

    return linhas.slice(startIdx).map((linha, i) => {
      if (isBling) {
        const cols = linha.split('\t')
        const codigo = cols[1]?.trim() ?? ''
        const descricao = cols[2]?.trim() ?? ''

        if (!codigo) {
          return { codigo: '', modelo: '', cor: '', tamanho: '', descricao, valida: false, erro: `Linha ${startIdx + i + 1}: código vazio` }
        }

        // Preview simplificado: extrair referência do código pelo sufixo
        // O parsing real acontece no backend via parseSku
        return { codigo, modelo: '(via SKU)', cor: '', tamanho: '', descricao, valida: true }
      }

      // Formato manual (backward compat)
      const sep = linha.includes(';') ? ';' : ','
      const partes = linha.split(sep).map((p) => p.trim())
      const cod = partes[0] ?? ''
      const nome = partes[1] ?? ''
      if (!cod || !nome) {
        return { codigo: cod, modelo: '', cor: '', tamanho: '', descricao: nome, valida: false, erro: `Linha ${i + 1}: código e nome obrigatórios` }
      }
      return { codigo: cod, modelo: cod, cor: '', tamanho: '', descricao: nome, valida: true }
    })
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result
      if (typeof text === 'string') {
        setCsvTexto(text)
        setPreview([])
      }
    }
    reader.readAsText(file, 'UTF-8')
    // Limpar o input para permitir re-upload do mesmo arquivo
    e.target.value = ''
  }

  async function importar() {
    if (!csvTexto.trim()) { toast.error('Selecione ou cole os dados antes de importar'); return }
    setImporting(true)
    try {
      const result = await apiClient.post<ImportResult>(
        `${API_ROUTES.MODELOS}/bulk-import`,
        { dados: csvTexto },
      )
      const partes: string[] = []
      if (result.modelosCriados > 0) partes.push(`${result.modelosCriados} modelo(s) criado(s)`)
      if (result.modelosExistentes > 0) partes.push(`${result.modelosExistentes} já existente(s)`)
      if (result.variantesCriadas > 0) partes.push(`${result.variantesCriadas} variante(s) criada(s)`)
      if (result.linhasIgnoradas > 0) partes.push(`${result.linhasIgnoradas} ignorada(s)`)
      if (result.erros.length > 0) partes.push(`${result.erros.length} erro(s)`)
      const msg = partes.length > 0 ? partes.join(', ') : 'Nenhum dado processado'

      if (result.erros.length > 0) {
        toast.error(`Importado com erros: ${msg}`)
      } else {
        toast.success(`Importação concluída: ${msg}`)
      }
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

  function cancelSync() {
    syncAbortRef.current?.abort()
  }

  async function syncBling() {
    const abortController = new AbortController()
    syncAbortRef.current = abortController

    setSyncing(true)
    setSyncProgress(null)

    const totais = { criadas: 0, atualizadas: 0, modelosCriados: 0, semImagem: 0, imagensBaixadas: 0, erros: [] as string[] }
    const MAX_ERROS = 100
    let totalProcessados = 0

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
      const infoRes = await doFetch(`${API_ROUTES.VARIANTES_SYNC_BLING}?pagina=info`)
      if (!infoRes.ok) throw new Error(`Erro ${infoRes.status}`)
      const info = await infoRes.json() as { isFullSync: boolean }

      if (info.isFullSync) {
        toast.info('Primeira sincronização — pode levar alguns minutos.')
      }

      // 2. Paginar até hasMore=false
      let pagina = 1
      let hasMore = true

      while (hasMore) {
        if (abortController.signal.aborted) break

        setSyncProgress({
          atual: totalProcessados,
          produto: info.isFullSync ? `Sync completa — página ${pagina}…` : `Página ${pagina}…`,
        })

        const res = await doFetch(`${API_ROUTES.VARIANTES_SYNC_BLING}?pagina=${pagina}`)
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

      // 5. Mostrar resultado
      const partes: string[] = []
      if (totais.modelosCriados > 0) partes.push(`${totais.modelosCriados} modelo(s) criado(s)`)
      if (totais.criadas > 0) partes.push(`${totais.criadas} variante(s) criada(s)`)
      if (totais.atualizadas > 0) partes.push(`${totais.atualizadas} variante(s) atualizada(s)`)
      if (totais.imagensBaixadas > 0) partes.push(`${totais.imagensBaixadas} imagem(ns) importada(s)`)
      if (totais.erros.length > 0) partes.push(`${totais.erros.length} erro(s)`)
      const msg = partes.length > 0 ? partes.join(', ') : 'Nenhuma variante nova'

      if (abortController.signal.aborted) {
        toast.info(`Cancelado. ${msg}`)
      } else if (totais.erros.length > 0) {
        toast.error(`Sincronizado com erros: ${msg}`)
      } else {
        toast.success(`Sincronização concluída: ${msg}`)
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
            <>
              <span className="text-sm text-secondary animate-pulse">
                {syncProgress
                  ? `${syncProgress.produto} (${syncProgress.atual} produtos)`
                  : 'Conectando…'}
              </span>
              <Button variant="destructive" size="sm" onClick={cancelSync}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => void syncBling()}>
              Sincronizar Bling
            </Button>
          )}
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

      {/* Modal importação em lote */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Modelos em Lote"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Importe o CSV exportado pelo Bling. Apenas as colunas <strong>Código</strong> e <strong>Descrição</strong> serão usadas.<br />
            O SKU será parseado para extrair referência, cor e tamanho. Campos de ficha ficam em branco.<br />
            <span className="text-xs text-secondary/70">O arquivo CSV não é armazenado — é processado e descartado.</span>
          </p>

          {/* Upload de arquivo */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="csv-upload"
              className="cursor-pointer rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              Selecionar arquivo CSV
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Upload de arquivo CSV"
            />
            {csvTexto && (
              <span className="text-xs text-secondary">
                {csvTexto.split('\n').filter((l) => l.trim()).length} linhas carregadas
              </span>
            )}
          </div>

          {/* Textarea para colar (alternativa) */}
          <details className="text-sm">
            <summary className="cursor-pointer text-secondary hover:text-foreground">Ou cole o conteúdo manualmente</summary>
            <textarea
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={6}
              placeholder="Cole o conteúdo do CSV exportado do Bling aqui..."
              value={csvTexto}
              onChange={(e) => { setCsvTexto(e.target.value); setPreview([]) }}
              aria-label="Dados dos modelos"
            />
          </details>

          {csvTexto.trim() && (
            <Button variant="secondary" onClick={() => setPreview(gerarPreview(csvTexto))}>
              Pré-visualizar
            </Button>
          )}

          {preview.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Código SKU</th>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} className={!p.valida ? 'bg-destructive/5' : ''}>
                      <td className="px-2 py-1 font-mono">{p.codigo || '—'}</td>
                      <td className="px-2 py-1 text-secondary truncate max-w-[200px]">{p.descricao || '—'}</td>
                      <td className={`px-2 py-1 ${p.valida ? 'text-success' : 'text-destructive'}`}>
                        {p.valida ? 'OK' : p.erro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2 py-1 text-xs text-secondary border-t border-border">
                {preview.filter((p) => p.valida).length} válidas, {preview.filter((p) => !p.valida).length} ignoradas
              </p>
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
