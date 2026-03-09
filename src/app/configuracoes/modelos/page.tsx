'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES, ROUTES } from '@/lib/constants'
import { toast } from 'sonner'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface VarianteCor {
  id: string
  corCodigo: string
  cabedalOverride: string | null
  corSola: string | null
  corFacheta: string | null
  corForroPalmilha: string | null
  codigoFichaPalmilha: string | null
  descricaoPalmilha: string | null
}

interface Modelo {
  id: string
  codigo: string
  nome: string
  cabedal: string | null
  sola: string | null
  palmilha: string | null
  temFacheta: boolean
  materialBasePalmilha: string | null
  linha: string | null
  observacoes: string | null
  ativo: boolean
  createdAt: string
  variantesCor: VarianteCor[]
}

interface ListResponse {
  items: Modelo[]
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

// ── Content ───────────────────────────────────────────────────────────────────

function ModelosContent() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal criar/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Modelo | null>(null)
  const [formCodigo, setFormCodigo] = useState('')
  const [formNome, setFormNome] = useState('')
  const [formCabedal, setFormCabedal] = useState('')
  const [formSola, setFormSola] = useState('')
  const [formPalmilha, setFormPalmilha] = useState('')
  const [formTemFacheta, setFormTemFacheta] = useState(false)
  const [formMaterialBasePalmilha, setFormMaterialBasePalmilha] = useState('')
  const [formLinha, setFormLinha] = useState('')
  const [formObs, setFormObs] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal variantes por cor
  const [variantesModalOpen, setVariantesModalOpen] = useState(false)
  const [variantesModelo, setVariantesModelo] = useState<Modelo | null>(null)
  const [varianteForm, setVarianteForm] = useState({
    corCodigo: '',
    cabedalOverride: '',
    corSola: '',
    corFacheta: '',
    corForroPalmilha: '',
    codigoFichaPalmilha: '',
    descricaoPalmilha: '',
  })
  const [editandoVariante, setEditandoVariante] = useState<VarianteCor | null>(null)
  const [savingVariante, setSavingVariante] = useState(false)

  // Modal importação em lote
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [csvTexto, setCsvTexto] = useState('')
  const [preview, setPreview] = useState<PreviewLinha[]>([])
  const [importing, setImporting] = useState(false)

  // Confirm excluir
  const [confirmExcluir, setConfirmExcluir] = useState<Modelo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchModelos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (search) params.set('search', search)
      const data = await apiClient.get<ListResponse>(`${API_ROUTES.MODELOS}?${params.toString()}`)
      setModelos(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { void fetchModelos() }, [fetchModelos])

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function abrirCriar() {
    setEditando(null)
    setFormCodigo('')
    setFormNome('')
    setFormCabedal('')
    setFormSola('')
    setFormPalmilha('')
    setFormTemFacheta(false)
    setFormMaterialBasePalmilha('')
    setFormLinha('')
    setFormObs('')
    setModalOpen(true)
  }

  function abrirEditar(m: Modelo) {
    setEditando(m)
    setFormCodigo(m.codigo)
    setFormNome(m.nome)
    setFormCabedal(m.cabedal ?? '')
    setFormSola(m.sola ?? '')
    setFormPalmilha(m.palmilha ?? '')
    setFormTemFacheta(m.temFacheta)
    setFormMaterialBasePalmilha(m.materialBasePalmilha ?? '')
    setFormLinha(m.linha ?? '')
    setFormObs(m.observacoes ?? '')
    setModalOpen(true)
  }

  async function salvar() {
    const codigo = formCodigo.trim()
    const nome = formNome.trim()
    if (!codigo) { toast.error('Código é obrigatório'); return }
    if (!nome) { toast.error('Nome é obrigatório'); return }

    setSaving(true)
    try {
      const body = {
        codigo,
        nome,
        cabedal: formCabedal.trim() || null,
        sola: formSola.trim() || null,
        palmilha: formPalmilha.trim() || null,
        temFacheta: formTemFacheta,
        materialBasePalmilha: formMaterialBasePalmilha.trim() || null,
        linha: formLinha.trim() || null,
        observacoes: formObs.trim() || null,
      }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.MODELOS}/${editando.id}`, body)
        toast.success('Modelo atualizado')
      } else {
        await apiClient.post(API_ROUTES.MODELOS, body)
        toast.success('Modelo criado')
      }
      setModalOpen(false)
      await fetchModelos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

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

  // ── Variantes por cor ─────────────────────────────────────────────────────

  function abrirVariantes(m: Modelo) {
    setVariantesModelo(m)
    setEditandoVariante(null)
    resetVarianteForm()
    setVariantesModalOpen(true)
  }

  function resetVarianteForm() {
    setVarianteForm({
      corCodigo: '',
      cabedalOverride: '',
      corSola: '',
      corFacheta: '',
      corForroPalmilha: '',
      codigoFichaPalmilha: '',
      descricaoPalmilha: '',
    })
  }

  function editarVariante(v: VarianteCor) {
    setEditandoVariante(v)
    setVarianteForm({
      corCodigo: v.corCodigo,
      cabedalOverride: v.cabedalOverride ?? '',
      corSola: v.corSola ?? '',
      corFacheta: v.corFacheta ?? '',
      corForroPalmilha: v.corForroPalmilha ?? '',
      codigoFichaPalmilha: v.codigoFichaPalmilha ?? '',
      descricaoPalmilha: v.descricaoPalmilha ?? '',
    })
  }

  async function salvarVariante() {
    if (!variantesModelo) return
    if (!varianteForm.corCodigo.trim()) { toast.error('Código da cor é obrigatório'); return }

    setSavingVariante(true)
    try {
      const body = {
        corCodigo: varianteForm.corCodigo.trim(),
        cabedalOverride: varianteForm.cabedalOverride.trim() || null,
        corSola: varianteForm.corSola.trim() || null,
        corFacheta: varianteForm.corFacheta.trim() || null,
        corForroPalmilha: varianteForm.corForroPalmilha.trim() || null,
        codigoFichaPalmilha: varianteForm.codigoFichaPalmilha.trim() || null,
        descricaoPalmilha: varianteForm.descricaoPalmilha.trim() || null,
      }

      if (editandoVariante) {
        await apiClient.patch(
          `${API_ROUTES.MODELOS}/${variantesModelo.id}/variantes-cor/${editandoVariante.id}`,
          body,
        )
        toast.success('Variante atualizada')
      } else {
        await apiClient.post(
          `${API_ROUTES.MODELOS}/${variantesModelo.id}/variantes-cor`,
          body,
        )
        toast.success('Variante criada')
      }
      setEditandoVariante(null)
      resetVarianteForm()
      await fetchModelos()
      // Atualizar o modelo local
      const updated = modelos.find((m) => m.id === variantesModelo.id)
      if (updated) setVariantesModelo(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar variante')
    } finally {
      setSavingVariante(false)
    }
  }

  async function excluirVariante(v: VarianteCor) {
    if (!variantesModelo) return
    try {
      await apiClient.delete(`${API_ROUTES.MODELOS}/${variantesModelo.id}/variantes-cor/${v.id}`)
      toast.success('Variante excluída')
      await fetchModelos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir variante')
    }
  }

  // Sincronizar variantesModelo com modelos atualizados
  useEffect(() => {
    if (variantesModelo) {
      const updated = modelos.find((m) => m.id === variantesModelo.id)
      if (updated) setVariantesModelo(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos])

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

  // ── Colunas ─────────────────────────────────────────────────────────────────

  const empty = <span className="text-sm text-secondary">—</span>

  const COLUMNS: Column<Modelo>[] = [
    { key: 'codigo', header: 'Código', mono: true, sortable: true },
    { key: 'nome', header: 'Nome', sortable: true },
    {
      key: 'cabedal',
      header: 'Cabedal',
      render: (m) => m.cabedal ? <span className="text-sm text-foreground">{m.cabedal}</span> : empty,
    },
    {
      key: 'sola',
      header: 'Sola',
      render: (m) => m.sola ? <span className="text-sm text-foreground">{m.sola}</span> : empty,
    },
    {
      key: 'palmilha',
      header: 'Palmilha',
      render: (m) => m.palmilha ? <span className="text-sm text-foreground">{m.palmilha}</span> : empty,
    },
    {
      key: 'linha',
      header: 'Linha',
      render: (m) => m.linha ? <span className="text-sm text-secondary">{m.linha}</span> : empty,
    },
    {
      key: 'variantesCor',
      header: 'Variantes',
      render: (m) => (
        <button
          onClick={() => abrirVariantes(m)}
          className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
        >
          {m.variantesCor.length > 0 ? `${m.variantesCor.length} cor${m.variantesCor.length > 1 ? 'es' : ''}` : 'Adicionar'}
        </button>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right' as const,
      render: (m) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => abrirEditar(m)}
            className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
          >
            Editar
          </button>
          <button
            onClick={() => setConfirmExcluir(m)}
            className="text-xs font-medium text-destructive hover:underline focus:outline-none focus:underline"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState title="Erro ao carregar modelos" description={error} onRetry={fetchModelos} />
  }

  const inputClass = 'mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

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
          <Button onClick={abrirCriar}>Novo Modelo</Button>
        </div>
      </div>

      {/* Busca */}
      <input
        type="search"
        placeholder="Buscar por código, nome, cabedal, sola, palmilha ou linha"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full max-w-sm rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Buscar modelos"
      />

      {/* Tabela */}
      <DataTable
        data={modelos}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nenhum modelo cadastrado"
        pagination={{ page, pageSize: 50, total }}
        onPageChange={setPage}
      />

      {/* ── Modal criar/editar ─────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Modelo' : 'Novo Modelo'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-codigo">Código (referência)</label>
              <input
                id="m-codigo"
                type="text"
                className={`${inputClass} font-mono`}
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ex: 607"
                maxLength={30}
                disabled={!!editando}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-nome">Nome</label>
              <input
                id="m-nome"
                type="text"
                className={inputClass}
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Modelo 607"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-cabedal">Cabedal</label>
              <input
                id="m-cabedal"
                type="text"
                className={inputClass}
                value={formCabedal}
                onChange={(e) => setFormCabedal(e.target.value)}
                placeholder="Ex: SANTORINE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-sola">Sola</label>
              <input
                id="m-sola"
                type="text"
                className={inputClass}
                value={formSola}
                onChange={(e) => setFormSola(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-palmilha">Palmilha</label>
              <input
                id="m-palmilha"
                type="text"
                className={inputClass}
                value={formPalmilha}
                onChange={(e) => setFormPalmilha(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-linha">Linha</label>
              <input
                id="m-linha"
                type="text"
                className={inputClass}
                value={formLinha}
                onChange={(e) => setFormLinha(e.target.value)}
                placeholder="Ex: 607-611"
              />
              <p className="mt-0.5 text-xs text-secondary">Agrupa modelos da mesma linha</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-mat-palmilha">Material Base Palmilha</label>
              <input
                id="m-mat-palmilha"
                type="text"
                className={inputClass}
                value={formMaterialBasePalmilha}
                onChange={(e) => setFormMaterialBasePalmilha(e.target.value)}
                placeholder="Ex: PLANTEX 1.4"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formTemFacheta}
                  onChange={(e) => setFormTemFacheta(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                Possui facheta do salto
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="m-obs">Observações</label>
            <textarea
              id="m-obs"
              rows={2}
              className={inputClass}
              value={formObs}
              onChange={(e) => setFormObs(e.target.value)}
              placeholder="Instruções especiais, materiais, etc."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal variantes por cor ────────────────────────────────────────── */}
      <Modal
        open={variantesModalOpen}
        onClose={() => setVariantesModalOpen(false)}
        title={`Variantes por Cor — ${variantesModelo?.codigo ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Defina materiais e detalhes que variam conforme a cor do produto.
            {variantesModelo?.cabedal && <> Cabedal padrão: <strong>{variantesModelo.cabedal}</strong>.</>}
          </p>

          {/* Lista de variantes existentes */}
          {variantesModelo && variantesModelo.variantesCor.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Cor</th>
                    <th className="px-2 py-1 text-left">Cabedal</th>
                    <th className="px-2 py-1 text-left">Cor Sola</th>
                    <th className="px-2 py-1 text-left">Facheta</th>
                    <th className="px-2 py-1 text-left">Forro Palm.</th>
                    <th className="px-2 py-1 text-left">Ficha Palm.</th>
                    <th className="px-2 py-1 text-left">Desc. Palm.</th>
                    <th className="px-2 py-1 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {variantesModelo.variantesCor.map((v) => (
                    <tr key={v.id} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{v.corCodigo}</td>
                      <td className="px-2 py-1 text-secondary">{v.cabedalOverride ?? '—'}</td>
                      <td className="px-2 py-1 text-secondary">{v.corSola ?? '—'}</td>
                      <td className="px-2 py-1 text-secondary">{v.corFacheta ?? '—'}</td>
                      <td className="px-2 py-1 text-secondary">{v.corForroPalmilha ?? '—'}</td>
                      <td className="px-2 py-1 text-secondary font-mono">{v.codigoFichaPalmilha ?? '—'}</td>
                      <td className="px-2 py-1 text-secondary">{v.descricaoPalmilha ?? '—'}</td>
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => editarVariante(v)}
                            className="text-primary hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirVariante(v)}
                            className="text-destructive hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Formulário de variante */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <p className="text-xs font-medium text-foreground">
              {editandoVariante ? `Editando variante: ${editandoVariante.corCodigo}` : 'Nova variante'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-cor">Código da Cor *</label>
                <input
                  id="v-cor"
                  type="text"
                  className={`${inputClass} text-xs font-mono`}
                  value={varianteForm.corCodigo}
                  onChange={(e) => setVarianteForm({ ...varianteForm, corCodigo: e.target.value })}
                  placeholder="Ex: 444"
                  disabled={!!editandoVariante}
                />
              </div>
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-cabedal">Cabedal (override)</label>
                <input
                  id="v-cabedal"
                  type="text"
                  className={`${inputClass} text-xs`}
                  value={varianteForm.cabedalOverride}
                  onChange={(e) => setVarianteForm({ ...varianteForm, cabedalOverride: e.target.value })}
                  placeholder="Só se diferente do padrão"
                />
              </div>
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-cor-sola">Cor da Sola</label>
                <input
                  id="v-cor-sola"
                  type="text"
                  className={`${inputClass} text-xs`}
                  value={varianteForm.corSola}
                  onChange={(e) => setVarianteForm({ ...varianteForm, corSola: e.target.value })}
                  placeholder="Ex: BEGE"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-facheta">Cor da Facheta</label>
                <input
                  id="v-facheta"
                  type="text"
                  className={`${inputClass} text-xs`}
                  value={varianteForm.corFacheta}
                  onChange={(e) => setVarianteForm({ ...varianteForm, corFacheta: e.target.value })}
                  placeholder="Ex: BALÉ"
                />
              </div>
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-forro">Cor Forro Palmilha</label>
                <input
                  id="v-forro"
                  type="text"
                  className={`${inputClass} text-xs`}
                  value={varianteForm.corForroPalmilha}
                  onChange={(e) => setVarianteForm({ ...varianteForm, corForroPalmilha: e.target.value })}
                  placeholder="Ex: OURO LIGHT"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-cod-palm">Código Ficha Palmilha</label>
                <input
                  id="v-cod-palm"
                  type="text"
                  className={`${inputClass} text-xs font-mono`}
                  value={varianteForm.codigoFichaPalmilha}
                  onChange={(e) => setVarianteForm({ ...varianteForm, codigoFichaPalmilha: e.target.value })}
                  placeholder="Ex: 607444"
                />
              </div>
              <div>
                <label className="block text-xs text-secondary" htmlFor="v-desc-palm">Descrição Palmilha</label>
                <input
                  id="v-desc-palm"
                  type="text"
                  className={`${inputClass} text-xs`}
                  value={varianteForm.descricaoPalmilha}
                  onChange={(e) => setVarianteForm({ ...varianteForm, descricaoPalmilha: e.target.value })}
                  placeholder="Ex: PALMILHA BALÉ"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editandoVariante && (
                <Button variant="secondary" onClick={() => { setEditandoVariante(null); resetVarianteForm() }}>
                  Cancelar
                </Button>
              )}
              <Button onClick={salvarVariante} disabled={savingVariante}>
                {savingVariante ? 'Salvando…' : editandoVariante ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setVariantesModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal importação em lote ───────────────────────────────────────── */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Modelos em Lote"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Cole os dados no formato:<br />
            <span className="font-mono text-xs">CODIGO;Nome;Cabedal;Sola;Palmilha;Linha;Observacoes</span><br />
            Cabedal, Sola, Palmilha, Linha e Observacoes são opcionais. Separador: <span className="font-mono">;</span> ou <span className="font-mono">,</span>
          </p>
          <textarea
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={8}
            placeholder={'607;Modelo 607;SANTORINE;100;100;607-611\n608;Modelo 608;SANTORINE;100;100;607-611'}
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
