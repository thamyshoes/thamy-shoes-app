import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CircuitBreaker, CircuitOpenError } from '../circuit-breaker'

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = new CircuitBreaker()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('estado inicial é closed', () => {
    expect(cb.getState()).toBe('closed')
  })

  it('executa função com sucesso em estado closed', async () => {
    const result = await cb.execute(() => Promise.resolve('ok'))
    expect(result).toBe('ok')
    expect(cb.getState()).toBe('closed')
  })

  it('abre após 5 falhas dentro da janela de 60s', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }
    expect(cb.getState()).toBe('open')
  })

  it('não abre com menos de 5 falhas', async () => {
    for (let i = 0; i < 4; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }
    expect(cb.getState()).toBe('closed')
  })

  it('lança CircuitOpenError quando open', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }
    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toBeInstanceOf(
      CircuitOpenError,
    )
  })

  it('transição open → half-open → closed após cooldown e sucesso', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }
    expect(cb.getState()).toBe('open')

    // Avança além do cooldown de 120s
    vi.advanceTimersByTime(121_000)

    const result = await cb.execute(() => Promise.resolve('recovered'))
    expect(result).toBe('recovered')
    expect(cb.getState()).toBe('closed')
  })

  it('volta para open se half-open falha', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }
    vi.advanceTimersByTime(121_000)

    await cb.execute(() => Promise.reject(new Error('fail again'))).catch(() => {})
    expect(cb.getState()).toBe('open')
  })

  it('reseta contador se falha fora da janela de 60s', async () => {
    for (let i = 0; i < 4; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }
    expect(cb.getState()).toBe('closed')

    // Avançar além da janela de 60s
    vi.advanceTimersByTime(61_000)

    // Nova falha — contador deve ter sido resetado
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('closed') // só 1 falha no novo ciclo
  })

  it('não lança CircuitOpenError antes do cooldown', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {})
    }

    // Avança apenas 119s (menos que o cooldown)
    vi.advanceTimersByTime(119_000)

    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toBeInstanceOf(
      CircuitOpenError,
    )
  })
})
