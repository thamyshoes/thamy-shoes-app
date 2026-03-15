'use client'

import { useState, useEffect } from 'react'
import { API_ROUTES } from '@/lib/constants'

export interface MaterialItem {
  id: string
  nome: string
  categoria: string
  createdAt: Date | string
}

interface CacheEntry {
  data: MaterialItem[]
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache: Record<string, CacheEntry> = {}
const inflight: Record<string, Promise<MaterialItem[]>> = {}

async function fetchMats(categoria: string): Promise<MaterialItem[]> {
  const existing = inflight[categoria]
  if (existing) return existing

  inflight[categoria] = (async () => {
    const res = await fetch(`${API_ROUTES.MATERIAIS}?categoria=${categoria}`)
    if (!res.ok) throw new Error('Erro ao carregar materiais')
    const data = await res.json() as MaterialItem[]
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

export function useMateriais(categoria: string) {
  const [materiais, setMateriais] = useState<MaterialItem[]>(() => cache[categoria]?.data ?? [])
  const [loading, setLoading] = useState(!isCacheValid(categoria))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isCacheValid(categoria)) {
      setMateriais(cache[categoria]!.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchMats(categoria)
      .then((data) => {
        setMateriais(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar materiais')
        setLoading(false)
      })
  }, [categoria])

  function invalidate() {
    delete cache[categoria]
  }

  return { materiais, loading, error, invalidate }
}
