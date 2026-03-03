'use client'

import { useState, useEffect } from 'react'
import { TIMING } from '@/lib/constants'

export function useDebounce<T>(value: T, delay: number = TIMING.DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
