'use client'

import { useState, useEffect, useCallback } from 'react'
import { StatusConexao } from '@/types'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES } from '@/lib/constants'

interface BlingStatusResponse {
  status: StatusConexao
  expiresAt: string | null
  connectedAt: string | null
}

interface UseBlingStatusReturn {
  status: StatusConexao
  expiresAt: Date | null
  connectedAt: Date | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBlingStatus(): UseBlingStatusReturn {
  const [status, setStatus] = useState<StatusConexao>(StatusConexao.DESCONECTADO)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<BlingStatusResponse>(API_ROUTES.BLING_STATUS)
      setStatus(res.status)
      setExpiresAt(res.expiresAt ? new Date(res.expiresAt) : null)
      setConnectedAt(res.connectedAt ? new Date(res.connectedAt) : null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar status do Bling'
      setError(message)
      setStatus(StatusConexao.DESCONECTADO)
      setExpiresAt(null)
      setConnectedAt(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { status, expiresAt, connectedAt, loading, error, refetch: fetchData }
}
