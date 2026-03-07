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

interface GradeModelo {
  id: string
  gradeId: string
  modelo: string
}

interface GradeNumeracao {
  id: string
  nome: string
  tamanhoMin: number
  tamanhoMax: number
  modelos: GradeModelo[]
  createdAt: string
  updatedAt: string
}

function gerarTamanhos(min: number, max: number): number[] {
  if (min >= max) return []
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

// ── Inner content ─────────────────────────────────────────────────────────────

function GradesContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
  const [grades, setGrades] = useState<GradeNumeracao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal criar/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<GradeNumeracao | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formMin, setFormMin] = useState(33)
  const [formMax, setFormMax] = useState(44)
  const [saving, setSaving] = useState(false)

  // Modal gerenciar modelos
  const [modelosModal, setModelosModal] = useState<GradeNumeracao | null>(null)
  const [novoModelo, setNovoModelo] = useState('')
  const [addingModelo, setAddingModelo] = useState(false)
  const [removingModelo, setRemovingModelo] = useState<string | null>(null)

  // Confirm remover modelo
  const [confirmRemoverModelo, setConfirmRemoverModelo] = useState<{ gradeId: string; modelo: string } | null>(null)

  // Confirm excluir
  const [confirmExcluir, setConfirmExcluir] = useState<GradeNumeracao | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchGrades = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<GradeNumeracao[]>(API_ROUTES.GRADES)
      setGrades(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar grades')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchGrades() }, [fetchGrades])

  function abrirCriar() {
    setEditando(null)
    setFormNome('')
    setFormMin(33)
    setFormMax(44)
    setModalOpen(true)
  }

  function abrirEditar(grade: GradeNumeracao) {
    setEditando(grade)
    setFormNome(grade.nome)
    setFormMin(grade.tamanhoMin)
    setFormMax(grade.tamanhoMax)
    setModalOpen(true)
  }

  async function salvar() {
    if (!formNome.trim()) { toast.error('Nome é obrigatório'); return }
    if (formMin >= formMax) { toast.error('Tamanho mínimo deve ser menor que o máximo'); return }

    setSaving(true)
    try {
      const body = { nome: formNome.trim(), tamanhoMin: formMin, tamanhoMax: formMax }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.GRADES}/${editando.id}`, body)
        toast.success('Grade atualizada')
      } else {
        await apiClient.post(API_ROUTES.GRADES, body)
        toast.success('Grade criada')
      }
      setModalOpen(false)
      await fetchGrades()
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
      await apiClient.delete(`${API_ROUTES.GRADES}/${confirmExcluir.id}`)
      toast.success('Grade excluída')
      setConfirmExcluir(null)
      await fetchGrades()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  async function adicionarModelo() {
    if (!modelosModal || !novoModelo.trim()) return
    setAddingModelo(true)
    try {
      // Checar se modelo já está em outra grade
      const outraGrade = grades.find(
        (g) => g.id !== modelosModal.id && g.modelos.some((m) => m.modelo === novoModelo.trim()),
      )
      if (outraGrade) {
        toast.warning(`Modelo "${novoModelo}" já associado à grade "${outraGrade.nome}". Adicionando mesmo assim…`)
      }
      await apiClient.post(`${API_ROUTES.GRADES}/${modelosModal.id}/modelos`, { modelo: novoModelo.trim() })
      toast.success('Modelo adicionado')
      setNovoModelo('')
      await fetchGrades()
      // Atualizar grade local no modal
      const updated = grades.find((g) => g.id === modelosModal.id)
      if (updated) {
        const fresh = await apiClient.get<GradeNumeracao[]>(API_ROUTES.GRADES)
        const freshGrade = fresh.find((g) => g.id === modelosModal.id)
        if (freshGrade) setModelosModal(freshGrade)
        setGrades(fresh)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar modelo')
    } finally {
      setAddingModelo(false)
    }
  }

  async function removerModeloConfirmado() {
    if (!confirmRemoverModelo) return
    const { gradeId, modelo } = confirmRemoverModelo
    setRemovingModelo(modelo)
    setConfirmRemoverModelo(null)
    try {
      await apiClient.delete(`${API_ROUTES.GRADES}/${gradeId}/modelos/${encodeURIComponent(modelo)}`)
      toast.success('Modelo removido')
      const fresh = await apiClient.get<GradeNumeracao[]>(API_ROUTES.GRADES)
      setGrades(fresh)
      const freshGrade = fresh.find((g) => g.id === gradeId)
      if (freshGrade) setModelosModal(freshGrade)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover modelo')
    } finally {
      setRemovingModelo(null)
    }
  }

  const previewTamanhos = gerarTamanhos(formMin, formMax)

  const COLUMNS: Column<GradeNumeracao>[] = [
    { key: 'nome', header: 'Nome', sortable: true },
    {
      key: 'tamanhoMin',
      header: 'Faixa',
      render: (g) => <span className="text-sm">{g.tamanhoMin} – {g.tamanhoMax}</span>,
    },
    {
      key: 'tamanhoMax',
      header: 'Tamanhos',
      align: 'right',
      render: (g) => <span className="text-sm">{g.tamanhoMax - g.tamanhoMin + 1}</span>,
    },
    {
      key: 'modelos',
      header: 'Modelos',
      render: (g) => (
        <div className="flex flex-wrap gap-1">
          {g.modelos.length === 0
            ? <span className="text-xs text-secondary">Nenhum</span>
            : g.modelos.slice(0, 3).map((m) => (
                <span key={m.id} className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.modelo}</span>
              ))}
          {g.modelos.length > 3 && (
            <span className="text-xs text-secondary">+{g.modelos.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (g) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => abrirEditar(g)} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Editar</button>
          <button onClick={() => { setModelosModal(g); setNovoModelo('') }} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Modelos</button>
          <button onClick={() => setConfirmExcluir(g)} className="text-xs font-medium text-destructive hover:underline focus:outline-none focus:underline">Excluir</button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState title="Erro ao carregar grades" description={error} onRetry={fetchGrades} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.MAPEAMENTO_SKU} className="hover:underline">Detalhes dos Produtos</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Grades de Numeração</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Grades de Numeração</h1>
        </div>
        <Button onClick={abrirCriar}>Nova Grade</Button>
      </div>

      {/* Tabela */}
      <DataTable
        data={grades}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nenhuma grade cadastrada"
      />

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Grade' : 'Nova Grade'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="grade-nome">Nome</label>
            <input
              id="grade-nome"
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Adulto"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="grade-min">Tamanho Mínimo</label>
              <input
                id="grade-min"
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formMin}
                onChange={(e) => setFormMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="grade-max">Tamanho Máximo</label>
              <input
                id="grade-max"
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formMax}
                onChange={(e) => setFormMax(Number(e.target.value))}
              />
            </div>
          </div>
          {previewTamanhos.length > 0 && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-secondary">
              {previewTamanhos.join(', ')} ({previewTamanhos.length} tamanho{previewTamanhos.length !== 1 ? 's' : ''})
            </div>
          )}
          {formMin >= formMax && (
            <p className="text-xs text-destructive">Tamanho mínimo deve ser menor que o máximo</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal gerenciar modelos */}
      <Modal
        open={!!modelosModal}
        onClose={() => setModelosModal(null)}
        title={`Modelos — ${modelosModal?.nome ?? ''}`}
      >
        {modelosModal && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: REF001"
                value={novoModelo}
                onChange={(e) => setNovoModelo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void adicionarModelo() }}
              />
              <Button onClick={adicionarModelo} disabled={addingModelo || !novoModelo.trim()}>
                {addingModelo ? '…' : '+ Adicionar'}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {modelosModal.modelos.length === 0 ? (
                <p className="text-sm text-secondary">Nenhum modelo associado</p>
              ) : (
                modelosModal.modelos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded border border-border px-3 py-1.5">
                    <span className="text-sm font-mono">{m.modelo}</span>
                    <button
                      onClick={() => setConfirmRemoverModelo({ gradeId: modelosModal.id, modelo: m.modelo })}
                      disabled={removingModelo === m.modelo}
                      className="text-xs text-destructive hover:underline disabled:opacity-40"
                      aria-label={`Remover modelo ${m.modelo}`}
                    >
                      {removingModelo === m.modelo ? '…' : '×'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setModelosModal(null)}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir grade"
        description={`Excluir "${confirmExcluir?.nome}"? Os modelos associados também serão removidos.`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
      />

      {/* Confirm remover modelo */}
      <ConfirmDialog
        open={!!confirmRemoverModelo}
        title="Remover modelo"
        description={`Remover o modelo "${confirmRemoverModelo?.modelo}" desta grade?`}
        variant="danger"
        onConfirm={removerModeloConfirmado}
        onClose={() => setConfirmRemoverModelo(null)}
        loading={!!removingModelo}
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const { user, loading: authLoading } = useAuth()
  if (authLoading || !user) return null
  return (
    <SidebarLayout user={user}>
      <GradesContent user={user} />
    </SidebarLayout>
  )
}
