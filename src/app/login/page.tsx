'use client'

import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient, ApiError } from '@/lib/api-client'
import { loginSchema, type LoginInput } from '@/lib/validators'
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] space-y-6 rounded-xl bg-card p-8 shadow-md">
        {/* Logo / título */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Image
              src="/logo.png"
              alt="Thamy Shoes"
              width={80}
              height={80}
              className="h-8 w-auto"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Thamy Shoes</h1>
          <p className="mt-1 text-sm text-secondary">
            Faça login para continuar
          </p>
        </div>

        {/* Lockout banner */}
        {isLocked && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
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

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Senha
            </label>
            <div className="relative">
              <Input
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
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || isLocked}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
