'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, notFound } from 'next/navigation'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES } from '@/lib/constants'
import { toast } from 'sonner'
import type { MaterialItem } from '@/hooks/use-materiais'

const TIPOS_VALIDOS: Record<string, string> = {
  cabedal: 'CABEDAL',
  sola: 'SOLA',
  palmilha: 'PALMILHA',
  facheta: 'FACHETA',
}

const TIPO_LABELS: Record<string, string> = {
  cabedal: 'Cabedal',
  sola: 'Sola',
  palmilha: 'Palmilha',
  facheta: 'Facheta',
}

// ── Materiais Panel ──────────────────────────────────────────────────────────

function MateriaisPanel({ categoria }: { categoria: string }) {
  const [items, setItems] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<MaterialItem | null>(null)
  const [formNome, setFormNome] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmExcluir, setConfirmExcluir] = useState<MaterialItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<MaterialItem[]>(`${API_ROUTES.MATERIAIS}?categoria=${categoria}`)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar materiais')
    } finally {
      setLoading(false)
    }
  }, [categoria])

  useEffect(() => { void fetchData() }, [fetchData])

  function abrirCriar() {
    setEditando(null)
    setFormNome('')
    setModalOpen(true)
  }

  function abrirEditar(item: MaterialItem) {
    setEditando(item)
    setFormNome(item.nome)
    setModalOpen(true)
  }

  async function salvar() {
    const nomeLimpo = formNome.trim()
    if (!nomeLimpo) { toast.error('Nome é obrigatório'); return }

    setSaving(true)
    try {
      const body = { nome: nomeLimpo, categoria }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.MATERIAIS}/${editando.id}`, body)
        toast.success('Material atualizado')
      } else {
        await apiClient.post(API_ROUTES.MATERIAIS, body)
        toast.success('Material criado')
      }
      setModalOpen(false)
      await fetchData()
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
      await apiClient.delete(`${API_ROUTES.MATERIAIS}/${confirmExcluir.id}`)
      toast.success('Material excluído')
      setConfirmExcluir(null)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<MaterialItem>[] = [
    { key: 'nome', header: 'Nome', sortable: true },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (m) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => abrirEditar(m)} className="text-xs font-medium text-primary hover:underline">Editar</button>
          <button onClick={() => setConfirmExcluir(m)} className="text-xs font-medium text-destructive hover:underline">Excluir</button>
        </div>
      ),
    },
  ]

  if (error) return <ErrorState title="Erro ao carregar materiais" description={error} onRetry={fetchData} />

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-secondary">{items.length} material(is) cadastrado(s)</p>
        <Button onClick={abrirCriar}>Novo Material</Button>
      </div>

      <DataTable data={items} columns={columns} loading={loading} emptyMessage="Nenhum material cadastrado" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Material' : 'Novo Material'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="mat-nome">Nome</label>
            <input
              id="mat-nome"
              data-autofocus
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Couro Natural"
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir material"
        description={`Excluir "${confirmExcluir?.nome}"?`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
      />
    </>
  )
}

// ── Page Content ─────────────────────────────────────────────────────────────

function MateriaPrimaContent({ tipo }: { tipo: string }) {
  const categoria = TIPOS_VALIDOS[tipo]
  const label = TIPO_LABELS[tipo]

  if (!categoria) return notFound()

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-secondary" aria-label="Breadcrumb">
          <span>Matéria Prima</span>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{label}</span>
        </nav>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Matéria Prima — {label}</h1>
      </div>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-4 text-base font-semibold text-foreground">Materiais</h2>
        <MateriaisPanel categoria={categoria} />
      </section>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MateriaPrimaPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams<{ tipo: string }>()

  if (authLoading || !user) return null

  return (
    <SidebarLayout user={user}>
      <MateriaPrimaContent tipo={params.tipo} />
    </SidebarLayout>
  )
}
