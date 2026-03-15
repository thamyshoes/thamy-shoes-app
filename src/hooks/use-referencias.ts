'use client'

import { useState, useEffect } from 'react'
import { API_ROUTES } from '@/lib/constants'

export interface ReferenciaItem {
  id: string
  codigo: string
  descricao: string | null
  categoria: string
  createdAt: Date | string
}

interface CacheEntry {
  data: ReferenciaItem[]
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache: Record<string, CacheEntry> = {}
const inflight: Record<string, Promise<ReferenciaItem[]>> = {}

async function fetchRefs(categoria: string): Promise<ReferenciaItem[]> {
  const existing = inflight[categoria]
  if (existing) return existing

  inflight[categoria] = (async () => {
    const res = await fetch(`${API_ROUTES.REFERENCIAS}?categoria=${categoria}`)
    if (!res.ok) throw new Error('Erro ao carregar referências')
    const data = await res.json() as ReferenciaItem[]
    cache[categoria] = { data, timestamp: Date.now() }
    return data
  })()

  try {
    return await inflight[categoria]
  } finally {
    delete inflight[categoria]
  }
}

function isCacheValid(categoria: string): boolean {
  const entry = cache[categoria]
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL_MS
}

export function useReferencias(categoria: string) {
  const [referencias, setReferencias] = useState<ReferenciaItem[]>(() => cache[categoria]?.data ?? [])
  const [loading, setLoading] = useState(!isCacheValid(categoria))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isCacheValid(categoria)) {
      setReferencias(cache[categoria]!.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchRefs(categoria)
      .then((data) => {
        setReferencias(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar referências')
        setLoading(false)
      })
  }, [categoria])

  function invalidate() {
    delete cache[categoria]
  }

  return { referencias, loading, error, invalidate }
}
