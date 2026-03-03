'use client'

import { useState, useEffect, useCallback } from 'react'
import { type PedidoCompra, StatusPedido } from '@/types'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES, LIMITS } from '@/lib/constants'
import type { PaginatedResponse } from '@/types'

interface UsePedidosFilters {
  status?: StatusPedido
  fornecedor?: string
  dataInicio?: string
  dataFim?: string
  page?: number
}

interface UsePedidosReturn {
  pedidos: PedidoCompra[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePedidos(filters?: UsePedidosFilters): UsePedidosReturn {
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const page = filters?.page ?? 1
  const status = filters?.status
  const fornecedor = filters?.fornecedor
  const dataInicio = filters?.dataInicio
  const dataFim = filters?.dataFim

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(LIMITS.PAGE_SIZE),
      })
      if (status) params.set('status', status)
      if (fornecedor) params.set('fornecedor', fornecedor)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)

      const res = await apiClient.get<PaginatedResponse<PedidoCompra>>(
        `${API_ROUTES.PEDIDOS}?${params}`,
      )
      setPedidos(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }, [page, status, fornecedor, dataInicio, dataFim])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { pedidos, total, loading, error, refetch: fetchData }
}
