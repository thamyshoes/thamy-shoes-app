'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Perfil, type UserSession } from '@/types'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES, ROUTES, TIMING, MESSAGES } from '@/lib/constants'

const INACTIVITY_CHECK_MS = 5 * 60 * 1000 // check every 5 min
const INACTIVITY_LIMIT_MS = TIMING.SESSION_TIMEOUT_MIN * 60 * 1000

interface UseAuthReturn {
  user: UserSession | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isPCP: boolean
  isProducao: boolean
  hasPermission: (perfis: Perfil[]) => boolean
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const lastActivityRef = useRef<number>(Date.now())
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Inactivity tracking ────────────────────────────────────────────────────

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const logoutFn = useCallback(async (reason?: 'inactivity') => {
    try {
      await apiClient.post(API_ROUTES.AUTH_LOGOUT, {})
    } catch {
      // ignore
    }
    setUser(null)
    if (typeof window !== 'undefined') {
      if (reason === 'inactivity') {
        toast.error(MESSAGES.ERROR.UNAUTHORIZED)
      }
      window.location.href = ROUTES.LOGIN
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const events = ['click', 'keydown', 'scroll', 'mousemove'] as const
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }))

    checkTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed > INACTIVITY_LIMIT_MS) {
        logoutFn('inactivity')
      }
    }, INACTIVITY_CHECK_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity))
      if (checkTimerRef.current) clearInterval(checkTimerRef.current)
    }
  }, [user, resetActivity, logoutFn])

  // ── Session bootstrap ──────────────────────────────────────────────────────

  useEffect(() => {
    apiClient
      .get<UserSession>(API_ROUTES.AUTH_ME)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const { user: session } = await apiClient.post<{ user: UserSession }>(
      API_ROUTES.AUTH_LOGIN,
      { email, password },
    )
    setUser(session)
  }, [])

  const hasPermission = useCallback(
    (perfis: Perfil[]): boolean => {
      if (!user) return false
      return perfis.includes(user.perfil)
    },
    [user],
  )

  return {
    user,
    loading,
    login,
    logout: logoutFn,
    isAdmin: user?.perfil === Perfil.ADMIN,
    isPCP: user?.perfil === Perfil.PCP,
    isProducao: user?.perfil === Perfil.PRODUCAO,
    hasPermission,
  }
}
