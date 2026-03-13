'use client'

import { useState, useEffect, useCallback } from 'react'

interface ModeloSemVariante {
  codigo: string
  nome: string
}

interface CorSemVariante {
  codigo: string
  nome: string
  cor: string
}

interface VerificarVariantesResult {
  todosComVariante: boolean
  modelosSemVariante: ModeloSemVariante[]
  coresSemVariante: CorSemVariante[]
}

interface UseVerificarVariantesReturn {
  data: VerificarVariantesResult | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useVerificarVariantes(pedidoId: string): UseVerificarVariantesReturn {
  const [data, setData] = useState<VerificarVariantesResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/modelos/verificar-variantes?pedidoId=${encodeURIComponent(pedidoId)}`,
      )
      if (!res.ok) throw new Error('Erro ao verificar variantes')
      const result = await res.json() as VerificarVariantesResult
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar variantes')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
