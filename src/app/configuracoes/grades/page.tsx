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

interface GradeNumeracao {
  id: string
  nome: string
  tamanhoMin: number
  tamanhoMax: number
  createdAt: string
  updatedAt: string
}

function gerarTamanhos(min: number, max: number): number[] {
  if (min >= max) return []
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

// ── Inner content ─────────────────────────────────────────────────────────────

function GradesContent() {
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
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (g) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => abrirEditar(g)} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Editar</button>
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
          <p className="mt-0.5 text-sm text-secondary">
            Cadastre as grades aqui. Para vincular modelos, use o campo "Grade de Numeração" no cadastro de cada modelo.
          </p>
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
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Adulto Feminino"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="grade-min">Tamanho Mínimo</label>
              <input
                id="grade-min"
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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

      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir grade"
        description={`Excluir "${confirmExcluir?.nome}"? Os modelos ficam sem grade vinculada.`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
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
      <GradesContent />
    </SidebarLayout>
  )
}
