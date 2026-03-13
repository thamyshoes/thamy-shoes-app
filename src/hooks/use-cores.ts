'use client'

import { useState, useEffect } from 'react'
import { API_ROUTES } from '@/lib/constants'

export interface MapeamentoCor {
  id: string
  codigo: string
  descricao: string
  hex?: string | null
  createdAt: Date | string
}

interface CoresCache {
  data: MapeamentoCor[]
  timestamp: number
}

// Cache global em memória — compartilhado entre instâncias do hook
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
let coresCache: CoresCache | null = null
let fetchPromise: Promise<MapeamentoCor[]> | null = null

async function fetchCores(): Promise<MapeamentoCor[]> {
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    const res = await fetch(API_ROUTES.MAPEAMENTO_CORES)
    if (!res.ok) throw new Error('Erro ao carregar cores')
    const cores = await res.json() as MapeamentoCor[]
    coresCache = { data: cores, timestamp: Date.now() }
    return cores
  })()

  try {
    return await fetchPromise
  } finally {
    fetchPromise = null
  }
}

function isCacheValid(): boolean {
  return !!coresCache && Date.now() - coresCache.timestamp < CACHE_TTL_MS
}

/**
 * Hook para carregar cores com cache de 5 minutos.
 * Equivalente a SWR com staleTime: 5min, revalidateOnFocus: false.
 */
export function useCores() {
  const [cores, setCores] = useState<MapeamentoCor[]>(() => coresCache?.data ?? [])
  const [loading, setLoading] = useState(!isCacheValid())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isCacheValid()) {
      setCores(coresCache!.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchCores()
      .then((data) => {
        setCores(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar cores')
        setLoading(false)
      })
  }, [])

  function invalidate() {
    coresCache = null
  }

  return { cores, loading, error, invalidate }
}
