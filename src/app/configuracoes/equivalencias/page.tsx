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
import { EscopoEquivalencia, type UserSession } from '@/types'

type Escopo = EscopoEquivalencia

interface RegraEquivalencia {
  id: string
  escopo: Escopo
  valor: string | null
  createdAt: string
  updatedAt: string
}

// ── Inner content ─────────────────────────────────────────────────────────────

function EquivalenciasContent({ user }: { user: UserSession }) {
  const [equivalencias, setEquivalencias] = useState<RegraEquivalencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal criar/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<RegraEquivalencia | null>(null)
  const [formEscopo, setFormEscopo] = useState<Escopo>('GLOBAL')
  const [formValor, setFormValor] = useState('')
  const [saving, setSaving] = useState(false)

  // Confirm excluir
  const [confirmExcluir, setConfirmExcluir] = useState<RegraEquivalencia | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEquivalencias = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<RegraEquivalencia[]>(API_ROUTES.EQUIVALENCIAS)
      setEquivalencias(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar equivalências')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchEquivalencias() }, [fetchEquivalencias])

  function abrirCriar() {
    setEditando(null)
    setFormEscopo('GLOBAL')
    setFormValor('')
    setModalOpen(true)
  }

  function abrirEditar(eq: RegraEquivalencia) {
    setEditando(eq)
    setFormEscopo(eq.escopo)
    setFormValor(eq.valor ?? '')
    setModalOpen(true)
  }

  async function salvar() {
    if (formEscopo === 'REFERENCIA' && !formValor.trim()) {
      toast.error('Modelo é obrigatório para escopo Por Referência')
      return
    }

    setSaving(true)
    try {
      const body = {
        escopo: formEscopo,
        valor: formEscopo === 'GLOBAL' ? null : formValor.trim(),
      }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.EQUIVALENCIAS}/${editando.id}`, body)
        toast.success('Equivalência atualizada')
      } else {
        await apiClient.post(API_ROUTES.EQUIVALENCIAS, body)
        toast.success('Equivalência criada')
      }
      setModalOpen(false)
      await fetchEquivalencias()
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
      await apiClient.delete(`${API_ROUTES.EQUIVALENCIAS}/${confirmExcluir.id}`)
      toast.success('Equivalência excluída')
      setConfirmExcluir(null)
      await fetchEquivalencias()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const COLUMNS: Column<RegraEquivalencia>[] = [
    {
      key: 'escopo',
      header: 'Escopo',
      render: (eq) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eq.escopo === 'GLOBAL' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
          {eq.escopo === 'GLOBAL' ? 'Global' : 'Por Referência'}
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Modelo',
      render: (eq) => (
        <span className={eq.valor ? 'font-mono text-sm' : 'text-secondary text-sm'}>
          {eq.valor ?? 'Todos'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (eq) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => abrirEditar(eq)} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Editar</button>
          <button onClick={() => setConfirmExcluir(eq)} className="text-xs font-medium text-destructive hover:underline focus:outline-none focus:underline">Excluir</button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState title="Erro ao carregar equivalências" description={error} onRetry={fetchEquivalencias} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.CONFIGURACOES} className="hover:underline">Configurações</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Equivalências</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Equivalências entre Setores</h1>
          <p className="mt-0.5 text-sm text-secondary">Quando palmilha e sola são iguais, gere fichas idênticas.</p>
        </div>
        <Button onClick={abrirCriar}>Nova Equivalência</Button>
      </div>

      {/* Tabela */}
      <DataTable
        data={equivalencias}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nenhuma equivalência configurada"
      />

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Equivalência' : 'Nova Equivalência'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="eq-escopo">Escopo</label>
            <select
              id="eq-escopo"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formEscopo}
              onChange={(e) => setFormEscopo(e.target.value as Escopo)}
            >
              <option value="GLOBAL">Global (todos os modelos)</option>
              <option value="REFERENCIA">Por Referência (modelo específico)</option>
            </select>
          </div>

          {formEscopo === 'REFERENCIA' && (
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="eq-valor">Modelo</label>
              <input
                id="eq-valor"
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
                placeholder="Ex: REF001"
              />
            </div>
          )}

          <div className="rounded-md bg-muted px-3 py-2 text-sm text-secondary">
            A ficha do setor palmilha terá conteúdo idêntico ao setor sola (e vice-versa).
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir equivalência"
        description="Excluir esta equivalência? As fichas futuras não serão mais geradas como idênticas."
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EquivalenciasPage() {
  const { user, loading: authLoading } = useAuth()
  if (authLoading || !user) return null
  return (
    <SidebarLayout user={user}>
      <EquivalenciasContent user={user} />
    </SidebarLayout>
  )
}
