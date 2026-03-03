'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import {
  resetPasswordFormSchema,
  type ResetPasswordFormInput,
} from '@/lib/validators'
import { ROUTES, API_ROUTES } from '@/lib/constants'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { token },
  })

  async function onSubmit(data: ResetPasswordFormInput) {
    if (!token) return
    setLoading(true)
    try {
      await apiClient.post(API_ROUTES.AUTH_RESET, {
        token,
        password: data.password,
      })
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao redefinir senha'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold text-foreground">Link inválido</h1>
        <p className="text-sm text-secondary">
          Este link de redefinição é inválido ou expirou.
        </p>
        <Button variant="primary" onClick={() => { window.location.href = ROUTES.LOGIN }}>
          Voltar ao login
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold text-foreground">Senha atualizada</h1>
        <p className="text-sm text-secondary">
          Sua senha foi redefinida com sucesso.
        </p>
        <Button variant="primary" onClick={() => { window.location.href = ROUTES.LOGIN }}>
          Ir para login
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="new-password" className="text-sm font-medium text-foreground">
          Nova senha
        </label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'new-password-error' : undefined}
            {...register('password')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="new-password-error" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
          Confirmar senha
        </label>
        <div className="relative">
          <Input
            id="confirm-password"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
            {...register('confirmPassword')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground"
            onClick={() => setShowConfirm((s) => !s)}
            aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p id="confirm-password-error" className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Redefinir senha
      </Button>
    </form>
  )
}

export default function ResetSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] space-y-6 rounded-xl bg-card p-8 shadow-md">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
