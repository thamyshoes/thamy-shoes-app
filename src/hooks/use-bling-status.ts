'use client'

import { useState, useEffect, useCallback } from 'react'
import { StatusConexao } from '@/types'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES } from '@/lib/constants'

interface BlingStatusResponse {
  status: StatusConexao
  expiresAt: string | null
  connectedAt: string | null
  refreshTokenExpiresAt: string | null
  configOk?: boolean
}

interface UseBlingStatusReturn {
  status: StatusConexao
  expiresAt: Date | null
  connectedAt: Date | null
  refreshTokenExpiresAt: Date | null
  configOk: boolean
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBlingStatus(): UseBlingStatusReturn {
  const [status, setStatus] = useState<StatusConexao>(StatusConexao.DESCONECTADO)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(null)
  const [refreshTokenExpiresAt, setRefreshTokenExpiresAt] = useState<Date | null>(null)
  const [configOk, setConfigOk] = useState(true)
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
      setRefreshTokenExpiresAt(
        res.refreshTokenExpiresAt ? new Date(res.refreshTokenExpiresAt) : null,
      )
      setConfigOk(res.configOk ?? true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar status do Bling'
      setError(message)
      setStatus(StatusConexao.DESCONECTADO)
      setExpiresAt(null)
      setConnectedAt(null)
      setRefreshTokenExpiresAt(null)
      setConfigOk(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return {
    status,
    expiresAt,
    connectedAt,
    refreshTokenExpiresAt,
    configOk,
    loading,
    error,
    refetch: fetchData,
  }
}
