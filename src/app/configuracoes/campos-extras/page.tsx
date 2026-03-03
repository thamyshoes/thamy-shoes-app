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
import { Setor, TipoCampo } from '@/types'
import { toast } from 'sonner'
import Link from 'next/link'

interface CampoExtra {
  id: string
  setor: Setor
  nome: string
  tipo: TipoCampo
  obrigatorio: boolean
  ativo: boolean
  ordem: number
  createdAt: string
  updatedAt: string
}

const TIPO_LABELS: Record<TipoCampo, string> = {
  TEXTO: 'Texto',
  NUMERO: 'Número',
  SELECAO: 'Seleção',
}

const TIPO_COLORS: Record<TipoCampo, string> = {
  TEXTO: 'bg-primary/10 text-primary',
  NUMERO: 'bg-success/10 text-success',
  SELECAO: 'bg-accent/10 text-accent',
}

const SETORES: { key: Setor; label: string }[] = [
  { key: Setor.CABEDAL, label: 'Cabedal' },
  { key: Setor.PALMILHA, label: 'Palmilha' },
  { key: Setor.SOLA, label: 'Sola' },
]

// ── Inner content ─────────────────────────────────────────────────────────────

function CamposExtrasContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
  const [abaAtiva, setAbaAtiva] = useState<Setor>(Setor.CABEDAL)
  const [campos, setCampos] = useState<CampoExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal criar/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<CampoExtra | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState<TipoCampo>('TEXTO')
  const [formObrigatorio, setFormObrigatorio] = useState(false)
  const [formOrdem, setFormOrdem] = useState(0)
  const [saving, setSaving] = useState(false)

  // Confirm excluir
  const [confirmExcluir, setConfirmExcluir] = useState<CampoExtra | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCampos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<CampoExtra[]>(`${API_ROUTES.CAMPOS_EXTRAS}?setor=${abaAtiva}`)
      setCampos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar campos')
    } finally {
      setLoading(false)
    }
  }, [abaAtiva])

  useEffect(() => { void fetchCampos() }, [fetchCampos])

  function abrirCriar() {
    setEditando(null)
    setFormNome('')
    setFormTipo('TEXTO')
    setFormObrigatorio(false)
    setFormOrdem(campos.length)
    setModalOpen(true)
  }

  function abrirEditar(campo: CampoExtra) {
    setEditando(campo)
    setFormNome(campo.nome)
    setFormTipo(campo.tipo)
    setFormObrigatorio(campo.obrigatorio)
    setFormOrdem(campo.ordem)
    setModalOpen(true)
  }

  async function salvar() {
    if (!formNome.trim()) { toast.error('Nome é obrigatório'); return }

    setSaving(true)
    try {
      const body = {
        setor: abaAtiva,
        nome: formNome.trim(),
        tipo: formTipo,
        obrigatorio: formObrigatorio,
        ordem: formOrdem,
      }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.CAMPOS_EXTRAS}/${editando.id}`, body)
        toast.success('Campo atualizado')
      } else {
        await apiClient.post(API_ROUTES.CAMPOS_EXTRAS, body)
        toast.success('Campo criado')
      }
      setModalOpen(false)
      await fetchCampos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function toggleObrigatorio(campo: CampoExtra) {
    setTogglingId(campo.id)
    setCampos((prev) => prev.map((c) => c.id === campo.id ? { ...c, obrigatorio: !c.obrigatorio } : c))
    try {
      await apiClient.patch(`${API_ROUTES.CAMPOS_EXTRAS}/${campo.id}`, { obrigatorio: !campo.obrigatorio })
      toast.success(campo.obrigatorio ? 'Campo opcional' : 'Campo obrigatório')
    } catch (err) {
      setCampos((prev) => prev.map((c) => c.id === campo.id ? { ...c, obrigatorio: campo.obrigatorio } : c))
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setTogglingId(null)
    }
  }

  async function toggleAtivo(campo: CampoExtra) {
    setTogglingId(campo.id)
    setCampos((prev) => prev.map((c) => c.id === campo.id ? { ...c, ativo: !c.ativo } : c))
    try {
      await apiClient.patch(`${API_ROUTES.CAMPOS_EXTRAS}/${campo.id}`, { ativo: !campo.ativo })
      toast.success(campo.ativo ? 'Campo desativado' : 'Campo ativado')
    } catch (err) {
      setCampos((prev) => prev.map((c) => c.id === campo.id ? { ...c, ativo: campo.ativo } : c))
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setTogglingId(null)
    }
  }

  async function excluir() {
    if (!confirmExcluir) return
    setDeleting(true)
    try {
      await apiClient.delete(`${API_ROUTES.CAMPOS_EXTRAS}/${confirmExcluir.id}`)
      toast.success('Campo excluído')
      setConfirmExcluir(null)
      await fetchCampos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const COLUMNS: Column<CampoExtra>[] = [
    {
      key: 'ordem',
      header: 'Ordem',
      align: 'right',
      render: (c) => <span className="text-sm text-secondary">{c.ordem}</span>,
    },
    { key: 'nome', header: 'Nome', sortable: true },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (c) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[c.tipo]}`}>
          {TIPO_LABELS[c.tipo]}
        </span>
      ),
    },
    {
      key: 'obrigatorio',
      header: 'Obrigatório',
      align: 'right',
      render: (c) => (
        <input
          type="checkbox"
          checked={c.obrigatorio}
          onChange={() => void toggleObrigatorio(c)}
          disabled={togglingId === c.id}
          className="h-4 w-4 cursor-pointer rounded border-border accent-primary disabled:opacity-50"
          aria-label={`Campo ${c.nome} obrigatório`}
        />
      ),
    },
    {
      key: 'ativo',
      header: 'Ativo',
      align: 'right',
      render: (c) => (
        <button
          role="switch"
          aria-checked={c.ativo}
          onClick={() => void toggleAtivo(c)}
          disabled={togglingId === c.id}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${c.ativo ? 'bg-primary' : 'bg-muted'}`}
          aria-label={`Campo ${c.nome} ativo`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${c.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => abrirEditar(c)} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Editar</button>
          <button onClick={() => setConfirmExcluir(c)} className="text-xs font-medium text-destructive hover:underline focus:outline-none focus:underline">Excluir</button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState title="Erro ao carregar campos" description={error} onRetry={fetchCampos} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.CONFIGURACOES} className="hover:underline">Configurações</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Campos Extras</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Campos Extras por Setor</h1>
        </div>
        <Button onClick={abrirCriar}>Novo Campo</Button>
      </div>

      {/* Abas de setor */}
      <div className="border-b border-border">
        <nav className="flex gap-1" role="tablist" aria-label="Setores">
          {SETORES.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={abaAtiva === s.key}
              onClick={() => setAbaAtiva(s.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                abaAtiva === s.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-secondary hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tabela */}
      <DataTable
        data={campos}
        columns={COLUMNS}
        loading={loading}
        emptyMessage={`Nenhum campo extra cadastrado para ${SETORES.find((s) => s.key === abaAtiva)?.label}`}
      />

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Campo' : `Novo Campo — ${SETORES.find((s) => s.key === abaAtiva)?.label}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="campo-nome">Nome</label>
            <input
              id="campo-nome"
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Acabamento"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="campo-tipo">Tipo</label>
            <select
              id="campo-tipo"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formTipo}
              onChange={(e) => setFormTipo(e.target.value as TipoCampo)}
            >
              <option value="TEXTO">Texto</option>
              <option value="NUMERO">Número</option>
              <option value="SELECAO">Seleção</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="campo-ordem">Ordem</label>
            <input
              id="campo-ordem"
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formOrdem}
              onChange={(e) => setFormOrdem(Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formObrigatorio}
              onChange={(e) => setFormObrigatorio(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">Obrigatório</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir campo"
        description={`Excluir o campo "${confirmExcluir?.nome}"?`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CamposExtrasPage() {
  const { user, loading: authLoading } = useAuth()
  if (authLoading || !user) return null
  return (
    <SidebarLayout user={user}>
      <CamposExtrasContent user={user} />
    </SidebarLayout>
  )
}
