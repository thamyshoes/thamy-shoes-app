'use client'

import { useState, useEffect, useCallback } from 'react'
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
import Link from 'next/link'

interface MapeamentoCor {
  id: string
  codigo: string
  descricao: string
  createdAt: string
}

interface PreviewLinha {
  codigo: string
  descricao: string
  valida: boolean
  erro?: string
}

// ── Inner content ─────────────────────────────────────────────────────────────

function CoresContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
  const [cores, setCores] = useState<MapeamentoCor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal criar/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<MapeamentoCor | null>(null)
  const [formCodigo, setFormCodigo] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal importação em lote
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [csvTexto, setCsvTexto] = useState('')
  const [preview, setPreview] = useState<PreviewLinha[]>([])
  const [importing, setImporting] = useState(false)

  // Confirm excluir
  const [confirmExcluir, setConfirmExcluir] = useState<MapeamentoCor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await apiClient.get<MapeamentoCor[]>(`${API_ROUTES.MAPEAMENTO_CORES}${params}`)
      setCores(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cores')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { void fetchCores() }, [fetchCores])

  function abrirCriar() {
    setEditando(null)
    setFormCodigo('')
    setFormDescricao('')
    setModalOpen(true)
  }

  function abrirEditar(cor: MapeamentoCor) {
    setEditando(cor)
    setFormCodigo(cor.codigo)
    setFormDescricao(cor.descricao)
    setModalOpen(true)
  }

  async function salvar() {
    const codigoLimpo = formCodigo.trim().toUpperCase()
    if (!codigoLimpo) { toast.error('Código é obrigatório'); return }
    if (!/^[A-Z0-9]+$/.test(codigoLimpo)) { toast.error('Código deve ser alfanumérico maiúsculo'); return }
    if (!formDescricao.trim()) { toast.error('Descrição é obrigatória'); return }

    setSaving(true)
    try {
      const body = { codigo: codigoLimpo, descricao: formDescricao.trim() }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.MAPEAMENTO_CORES}/${editando.id}`, body)
        toast.success('Cor atualizada')
      } else {
        await apiClient.post(API_ROUTES.MAPEAMENTO_CORES, body)
        toast.success('Cor criada')
      }
      setModalOpen(false)
      await fetchCores()
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
      await apiClient.delete(`${API_ROUTES.MAPEAMENTO_CORES}/${confirmExcluir.id}`)
      toast.success('Cor excluída')
      setConfirmExcluir(null)
      await fetchCores()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  function gerarPreview(csv: string): PreviewLinha[] {
    return csv
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linha, i) => {
        const partes = linha.includes(';') ? linha.split(';') : linha.split(',')
        if (partes.length < 2 || !partes[0]?.trim() || !partes[1]?.trim()) {
          return { codigo: '', descricao: '', valida: false, erro: `Linha ${i + 1}: formato inválido` }
        }
        return { codigo: partes[0].trim().toUpperCase(), descricao: partes[1].trim(), valida: true }
      })
  }

  function abrirImport() {
    setCsvTexto('')
    setPreview([])
    setImportModalOpen(true)
  }

  function handlePreview() {
    setPreview(gerarPreview(csvTexto))
  }

  async function importar() {
    if (!csvTexto.trim()) { toast.error('Cole o CSV antes de importar'); return }
    setImporting(true)
    try {
      const result = await apiClient.post<{ criados: number; atualizados: number; erros: string[] }>(
        `${API_ROUTES.MAPEAMENTO_CORES}/bulk-import`,
        { dados: csvTexto },
      )
      toast.success(`${result.criados} criados, ${result.atualizados} atualizados${result.erros.length ? `, ${result.erros.length} erros` : ''}`)
      setImportModalOpen(false)
      await fetchCores()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar')
    } finally {
      setImporting(false)
    }
  }

  const COLUMNS: Column<MapeamentoCor>[] = [
    {
      key: 'codigo',
      header: 'Código',
      mono: true,
      sortable: true,
      render: (c) => <span className="font-mono text-sm font-medium">{c.codigo}</span>,
    },
    {
      key: 'descricao',
      header: 'Descrição',
      sortable: true,
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => abrirEditar(c)}
            className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
          >
            Editar
          </button>
          <button
            onClick={() => setConfirmExcluir(c)}
            className="text-xs font-medium text-destructive hover:underline focus:outline-none focus:underline"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState title="Erro ao carregar mapeamentos" description={error} onRetry={fetchCores} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.CONFIGURACOES} className="hover:underline">Configurações</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Mapeamento de Cores</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Mapeamento de Cores</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={abrirImport}>Importar Lote</Button>
          <Button onClick={abrirCriar}>Nova Cor</Button>
        </div>
      </div>

      {/* Busca */}
      <input
        type="search"
        placeholder="Buscar por código ou descrição"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xs rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Buscar mapeamentos de cor"
      />

      {/* Tabela */}
      <DataTable
        data={cores}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nenhum mapeamento cadastrado"
      />

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Cor' : 'Nova Cor'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="cor-codigo">Código</label>
            <input
              id="cor-codigo"
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formCodigo}
              onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: PT"
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="cor-descricao">Descrição</label>
            <input
              id="cor-descricao"
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formDescricao}
              onChange={(e) => setFormDescricao(e.target.value)}
              placeholder="Ex: Preto"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal importação em lote */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Cores em Lote"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">Cole o CSV no formato <span className="font-mono">CODIGO;Descricao</span> (uma por linha)</p>
          <textarea
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={6}
            placeholder={'PT;Preto\nBR;Branco\n318;Dourado'}
            value={csvTexto}
            onChange={(e) => setCsvTexto(e.target.value)}
            aria-label="Conteúdo CSV"
          />
          <Button variant="secondary" onClick={handlePreview}>Pré-visualizar</Button>

          {preview.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Código</th>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} className={!p.valida ? 'bg-destructive/5' : ''}>
                      <td className="px-2 py-1 font-mono">{p.codigo || '—'}</td>
                      <td className="px-2 py-1">{p.descricao || '—'}</td>
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
        title="Excluir mapeamento"
        description={`Excluir a cor "${confirmExcluir?.codigo} - ${confirmExcluir?.descricao}"?`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CoresPage() {
  const { user, loading: authLoading } = useAuth()
  if (authLoading || !user) return null
  return (
    <SidebarLayout user={user}>
      <CoresContent user={user} />
    </SidebarLayout>
  )
}
