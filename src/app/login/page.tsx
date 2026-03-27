'use client'

import Image from 'next/image'
import logo from '../../../public/logo.png'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { apiClient, ApiError } from '@/lib/api-client'
import {
  loginSchema,
  forgotPasswordSchema,
  type LoginInput,
  type ForgotPasswordInput,
} from '@/lib/validators'
import { ROUTES, API_ROUTES } from '@/lib/constants'
import type { UserSession } from '@/types'
import { Perfil } from '@/types'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    reset: resetForgot,
    formState: { errors: forgotErrors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  useEffect(() => {
    setFocus('email')
  }, [setFocus])

  useEffect(() => {
    if (lockoutSeconds <= 0) return
    timerRef.current = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [lockoutSeconds])

  async function onSubmit(data: LoginInput) {
    if (lockoutSeconds > 0) return
    setLoading(true)
    try {
      const { user } = await apiClient.post<{ user: UserSession }>(
        API_ROUTES.AUTH_LOGIN,
        data,
      )
      const redirect =
        user.perfil === Perfil.PRODUCAO ? ROUTES.FICHAS : ROUTES.PEDIDOS
      window.location.href = redirect
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          const retryAfter = err.retryAfter ?? 900
          setLockoutSeconds(retryAfter)
          return
        }
        toast.error(err.message)
      } else {
        toast.error('Ocorreu um erro. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isLocked = lockoutSeconds > 0

  async function onForgotPassword(data: ForgotPasswordInput) {
    setForgotLoading(true)
    try {
      await apiClient.post(API_ROUTES.AUTH_FORGOT, data)
      setForgotSent(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar email'
      toast.error(message)
    } finally {
      setForgotLoading(false)
    }
  }

  function closeForgot() {
    setForgotOpen(false)
    setForgotSent(false)
    resetForgot()
  }

  return (
    <div data-testid="login-page" className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] rounded-xl bg-card p-8 shadow-md">
        {/* Logo / título */}
        <div className="text-center">
          <div className="mx-auto mb-0 flex h-40 w-auto items-center justify-center rounded-full bg-background">
            <Image
              src={logo}
              alt="Thamy Shoes"
              width={336}
              height={336}
              className="h-[134px] w-auto"
              priority
            />
          </div>
        </div>

        {/* Lockout banner */}
        {isLocked && (
          <div data-testid="login-lockout-banner" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-sm text-destructive">
              <p className="font-medium">Muitas tentativas</p>
              <p>
                Tente novamente em{' '}
                <span className="font-mono font-semibold">
                  {formatCountdown(lockoutSeconds)}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Formulário */}
        <form data-testid="form-login" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              data-testid="form-login-email-input"
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              disabled={isLocked}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Senha
            </label>
            <div className="relative">
              <Input
                data-testid="form-login-password-input"
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLocked}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                data-testid="form-login-toggle-password-button"
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
            <div className="flex justify-end">
              <button
                data-testid="form-login-forgot-password-button"
                type="button"
                className="text-xs text-secondary hover:text-foreground"
                onClick={() => setForgotOpen(true)}
              >
                Esqueci minha senha
              </button>
            </div>
          </div>

          <Button
            data-testid="form-login-submit-button"
            type="submit"
            className="w-full"
            disabled={loading || isLocked}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>

      <Modal open={forgotOpen} onClose={closeForgot} title="Redefinir senha" size="sm">
        {forgotSent ? (
          <div data-testid="modal-forgot-password-success" className="space-y-3 text-sm text-secondary">
            <p>
              Se o email estiver cadastrado, você receberá um link para redefinir a senha.
            </p>
            <Button variant="primary" onClick={closeForgot}>
              Entendi
            </Button>
          </div>
        ) : (
          <form data-testid="form-forgot-password" onSubmit={handleForgotSubmit(onForgotPassword)} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                data-testid="form-forgot-password-email-input"
                id="forgot-email"
                type="email"
                placeholder="seu@email.com"
                aria-invalid={!!forgotErrors.email}
                aria-describedby={forgotErrors.email ? 'forgot-email-error' : undefined}
                {...registerForgot('email')}
              />
              {forgotErrors.email && (
                <p id="forgot-email-error" className="text-xs text-destructive">
                  {forgotErrors.email.message}
                </p>
              )}
            </div>
            <Button data-testid="form-forgot-password-submit-button" type="submit" className="w-full" loading={forgotLoading}>
              Enviar link
            </Button>
          </form>
        )}
      </Modal>
    </div>
  )
}
