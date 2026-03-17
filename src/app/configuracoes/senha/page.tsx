'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'

const schema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  })

type FormInput = z.infer<typeof schema>

export default function AlterarSenhaPage() {
  const { user, loading: authLoading } = useAuth()
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormInput) {
    setSuccess(false)
    try {
      await apiClient.post('/api/auth/change-password', {
        senhaAtual: data.senhaAtual,
        novaSenha: data.novaSenha,
      })
      toast.success('Senha alterada com sucesso')
      setSuccess(true)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha')
    }
  }

  if (authLoading || !user) return null

  return (
    <SidebarLayout user={user}>
      <div className="space-y-6 max-w-md">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
          <p className="mt-0.5 text-sm text-secondary">Altere sua senha de acesso.</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Alterar Senha</h2>

          {success && (
            <div className="mb-4 rounded-md border border-success/30 bg-success/10 px-4 py-3">
              <p className="text-sm text-success">Senha alterada com sucesso.</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="senhaAtual" className="text-sm font-medium text-foreground">
                Senha atual
              </label>
              <Input
                id="senhaAtual"
                type="password"
                placeholder="••••••••"
                {...register('senhaAtual')}
              />
              {errors.senhaAtual && (
                <p className="text-xs text-destructive">{errors.senhaAtual.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="novaSenha" className="text-sm font-medium text-foreground">
                Nova senha
              </label>
              <Input
                id="novaSenha"
                type="password"
                placeholder="••••••••"
                {...register('novaSenha')}
              />
              {errors.novaSenha && (
                <p className="text-xs text-destructive">{errors.novaSenha.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmarSenha" className="text-sm font-medium text-foreground">
                Confirmar nova senha
              </label>
              <Input
                id="confirmarSenha"
                type="password"
                placeholder="••••••••"
                {...register('confirmarSenha')}
              />
              {errors.confirmarSenha && (
                <p className="text-xs text-destructive">{errors.confirmarSenha.message}</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Alterar Senha'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </SidebarLayout>
  )
}
