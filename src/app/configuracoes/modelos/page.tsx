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

interface Modelo {
  id: string
  codigo: string
  nome: string
  sola: string | null
  palmilha: string | null
  observacoes: string | null
  ativo: boolean
  createdAt: string
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
  const [formSola, setFormSola] = useState('')
  const [formPalmilha, setFormPalmilha] = useState('')
  const [formObs, setFormObs] = useState('')
  const [saving, setSaving] = useState(false)

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
    setFormSola('')
    setFormPalmilha('')
    setFormObs('')
    setModalOpen(true)
  }

  function abrirEditar(m: Modelo) {
    setEditando(m)
    setFormCodigo(m.codigo)
    setFormNome(m.nome)
    setFormSola(m.sola ?? '')
    setFormPalmilha(m.palmilha ?? '')
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
        sola: formSola.trim() || null,
        palmilha: formPalmilha.trim() || null,
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
          return { codigo, nome, sola: '', palmilha: '', valida: false, erro: `Linha ${i + 1}: código e nome obrigatórios` }
        }
        return { codigo, nome, sola: partes[2] ?? '', palmilha: partes[3] ?? '', valida: true }
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

  const COLUMNS: Column<Modelo>[] = [
    {
      key: 'codigo',
      header: 'Código',
      mono: true,
      sortable: true,
    },
    {
      key: 'nome',
      header: 'Nome',
      sortable: true,
    },
    {
      key: 'sola',
      header: 'Sola',
      render: (m) => m.sola ? <span className="text-sm text-foreground">{m.sola}</span> : <span className="text-sm text-secondary">—</span>,
    },
    {
      key: 'palmilha',
      header: 'Palmilha',
      render: (m) => m.palmilha ? <span className="text-sm text-foreground">{m.palmilha}</span> : <span className="text-sm text-secondary">—</span>,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.CONFIGURACOES} className="hover:underline">Configurações</Link>
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
        placeholder="Buscar por código, nome, sola ou palmilha"
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
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ex: 0101"
                maxLength={30}
                disabled={!!editando}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-nome">Nome</label>
              <input
                id="m-nome"
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Sandália Tira Fina"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-sola">Sola</label>
              <input
                id="m-sola"
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formSola}
                onChange={(e) => setFormSola(e.target.value)}
                placeholder="Ex: Sola TR Fina"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="m-palmilha">Palmilha</label>
              <input
                id="m-palmilha"
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formPalmilha}
                onChange={(e) => setFormPalmilha(e.target.value)}
                placeholder="Ex: EVA 3mm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="m-obs">Observações</label>
            <textarea
              id="m-obs"
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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

      {/* ── Modal importação em lote ───────────────────────────────────────── */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Modelos em Lote"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Cole os dados no formato:<br />
            <span className="font-mono text-xs">CODIGO;Nome;Sola;Palmilha;Observacoes</span><br />
            Sola, Palmilha e Observacoes são opcionais. Separador: <span className="font-mono">;</span> ou <span className="font-mono">,</span>
          </p>
          <textarea
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={8}
            placeholder={'0101;Sandália Tira Fina;Sola TR Fina;EVA 3mm\n0102;Scarpin Básico;Sola Couro;EVA 5mm'}
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
