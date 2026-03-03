'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState } from '@/components/ui/error-state'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { API_ROUTES, MESSAGES, LIMITS } from '@/lib/constants'
import { createUserSchema, editUserSchema } from '@/lib/validators'
import type { CreateUserInput, EditUserInput } from '@/lib/validators'
import { Perfil, Setor } from '@/types'
import type { PaginatedResponse, UserPublic } from '@/types'

// ── Badge helpers ──────────────────────────────────────────────────────────────

const PERFIL_VARIANT: Record<string, 'info' | 'accent' | 'default'> = {
  ADMIN: 'info',
  PCP: 'accent',
  PRODUCAO: 'default',
}

// ── Modal de Usuário ───────────────────────────────────────────────────────────

interface UserModalProps {
  editing: UserPublic | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
  selfId: string | undefined
}

function UserModal({ editing, open, onClose, onSuccess, selfId }: UserModalProps) {
  const isEdit = !!editing

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput | EditUserInput>({
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema),
    defaultValues: editing
      ? {
          nome: editing.nome,
          email: editing.email,
          password: '',
          perfil: editing.perfil as 'ADMIN' | 'PCP' | 'PRODUCAO',
          setor: editing.setor as 'CABEDAL' | 'PALMILHA' | 'SOLA' | null,
        }
      : { perfil: 'PCP', setor: null },
  })

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              nome: editing.nome,
              email: editing.email,
              password: '',
              perfil: editing.perfil as 'ADMIN' | 'PCP' | 'PRODUCAO',
              setor: editing.setor as 'CABEDAL' | 'PALMILHA' | 'SOLA' | null,
            }
          : { perfil: 'PCP', setor: null },
      )
    }
  }, [open, editing, reset])

  const perfil = watch('perfil')
  const showSetor = perfil === Perfil.PRODUCAO

  async function onSubmit(data: CreateUserInput | EditUserInput) {
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          nome: data.nome,
          email: data.email,
          perfil: data.perfil,
          setor: showSetor ? data.setor : null,
        }
        if ((data as EditUserInput).password) body.password = (data as EditUserInput).password
        await apiClient.put(API_ROUTES.USUARIO_DETALHE(editing!.id), body)
      } else {
        await apiClient.post(API_ROUTES.USUARIOS, data)
      }
      toast.success(MESSAGES.SUCCESS.SAVED)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Usuário' : 'Novo Usuário'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="user-nome" className="text-sm font-medium text-foreground">Nome</label>
          <Input id="user-nome" placeholder="Nome completo" {...register('nome')} />
          {errors.nome && (
            <p className="text-xs text-destructive">{errors.nome.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="user-email" className="text-sm font-medium text-foreground">Email</label>
          <Input id="user-email" type="email" placeholder="email@empresa.com" {...register('email')} />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="user-password" className="text-sm font-medium text-foreground">
            {isEdit ? 'Nova Senha (opcional)' : 'Senha'}
          </label>
          <Input id="user-password" type="password" placeholder="••••••••" {...register('password')} />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="user-perfil" className="text-sm font-medium text-foreground">Perfil</label>
          <select
            id="user-perfil"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('perfil')}
          >
            <option value="ADMIN">Administrador</option>
            <option value="PCP">PCP</option>
            <option value="PRODUCAO">Produção</option>
          </select>
          {errors.perfil && (
            <p className="text-xs text-destructive">{errors.perfil.message}</p>
          )}
        </div>

        {showSetor && (
          <div className="space-y-1">
            <label htmlFor="user-setor" className="text-sm font-medium text-foreground">Setor</label>
            <select
              id="user-setor"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('setor')}
            >
              <option value="">Selecione o setor</option>
              <option value="CABEDAL">Cabedal</option>
              <option value="PALMILHA">Palmilha</option>
              <option value="SOLA">Sola</option>
            </select>
            {errors.setor && (
              <p className="text-xs text-destructive">{errors.setor.message}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<UserPublic[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserPublic | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate')
  const [confirmLoading, setConfirmLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(LIMITS.PAGE_SIZE),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const data = await apiClient.get<PaginatedResponse<UserPublic>>(
        `${API_ROUTES.USUARIOS}?${params}`,
      )
      setUsers(data.data)
      setTotal(data.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // reset page on search change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const confirmTarget = users.find((u) => u.id === confirmId)

  async function handleToggleActive() {
    if (!confirmId) return
    setConfirmLoading(true)
    try {
      if (confirmAction === 'deactivate') {
        await apiClient.delete(API_ROUTES.USUARIO_DETALHE(confirmId))
      } else {
        await apiClient.put(API_ROUTES.USUARIO_DETALHE(confirmId), { ativo: true })
      }
      toast.success(MESSAGES.SUCCESS.SAVED)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setConfirmLoading(false)
      setConfirmId(null)
    }
  }

  const SETOR_LABEL: Record<string, string> = {
    CABEDAL: 'Cabedal',
    PALMILHA: 'Palmilha',
    SOLA: 'Sola',
  }

  const columns: Column<UserPublic>[] = [
    { key: 'nome', header: 'Nome', sortable: true },
    { key: 'email', header: 'Email', mono: true, sortable: true },
    {
      key: 'perfil',
      header: 'Perfil',
      render: (u) => (
        <StatusBadge
          status={u.perfil}
          variant={PERFIL_VARIANT[u.perfil] ?? 'default'}
        />
      ),
    },
    {
      key: 'setor',
      header: 'Setor',
      render: (u) => (
        <span className="text-secondary">
          {u.setor ? SETOR_LABEL[u.setor] ?? u.setor : '—'}
        </span>
      ),
    },
    {
      key: 'ativo',
      header: 'Status',
      render: (u) => (
        <StatusBadge
          status={u.ativo ? 'Ativo' : 'Inativo'}
          variant={u.ativo ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(u)
              setModalOpen(true)
            }}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={u.id === currentUser?.id}
            onClick={(e) => {
              e.stopPropagation()
              setConfirmId(u.id)
              setConfirmAction(u.ativo ? 'deactivate' : 'activate')
            }}
          >
            {u.ativo ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      ),
    },
  ]

  if (authLoading || !currentUser) return null

  return (
    <SidebarLayout user={currentUser}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {error ? (
          <ErrorState
            title="Erro ao carregar usuários"
            description="Não foi possível carregar a lista de usuários."
            onRetry={fetchUsers}
          />
        ) : (
          <DataTable
            data={users}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhum usuário encontrado"
            emptyAction={{
              label: 'Criar primeiro usuário',
              onClick: () => { setEditing(null); setModalOpen(true) },
            }}
            pagination={{ page, pageSize: LIMITS.PAGE_SIZE, total }}
            onPageChange={setPage}
          />
        )}
      </div>

      <UserModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSuccess={fetchUsers}
        selfId={currentUser?.id}
      />

      <ConfirmDialog
        open={!!confirmId}
        title={
          confirmAction === 'deactivate'
            ? `Desativar ${confirmTarget?.nome ?? 'usuário'}?`
            : `Ativar ${confirmTarget?.nome ?? 'usuário'}?`
        }
        description={
          confirmAction === 'deactivate'
            ? 'O usuário não poderá mais acessar o sistema.'
            : 'O usuário voltará a ter acesso ao sistema.'
        }
        confirmLabel={confirmAction === 'deactivate' ? 'Desativar' : 'Ativar'}
        variant={confirmAction === 'deactivate' ? 'danger' : 'default'}
        loading={confirmLoading}
        onConfirm={handleToggleActive}
        onClose={() => setConfirmId(null)}
      />
    </SidebarLayout>
  )
}
