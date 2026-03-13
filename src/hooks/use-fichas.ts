'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES, LIMITS } from '@/lib/constants'
import type { FichaProducao } from '@/types'
import { Setor } from '@/types'

export type FichaRow = FichaProducao & {
  pedido: { numero: string; fornecedorNome: string }
  consolidado: {
    id: string
    pedidos: { pedido: { numero: string } }[]
  } | null
}

/** Um grupo = todas as fichas de um mesmo pedido/consolidado */
export type FichaGroup = FichaRow[]

interface FichasResponse {
  groups: FichaGroup[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface UseFichasFilters {
  setor?: Setor
  pedidoId?: string
  dataInicio?: string
  dataFim?: string
  search?: string
  page?: number
}

interface UseFichasReturn {
  groups: FichaGroup[]
  total: number
  totalPages: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFichas(filters?: UseFichasFilters): UseFichasReturn {
  const [groups, setGroups] = useState<FichaGroup[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasDataRef = useRef(false)

  const page = filters?.page ?? 1
  const setor = filters?.setor
  const pedidoId = filters?.pedidoId
  const dataInicio = filters?.dataInicio
  const dataFim = filters?.dataFim
  const search = filters?.search

  const fetchData = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(LIMITS.PAGE_SIZE),
      })
      if (setor) params.set('setor', setor)
      if (pedidoId) params.set('pedidoId', pedidoId)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      if (search) params.set('search', search)

      const res = await apiClient.get<FichasResponse>(
        `${API_ROUTES.FICHAS}?${params}`,
      )
      setGroups(res.groups)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      hasDataRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fichas')
    } finally {
      setLoading(false)
    }
  }, [page, setor, pedidoId, dataInicio, dataFim, search])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { groups, total, totalPages, loading, error, refetch: fetchData }
}
