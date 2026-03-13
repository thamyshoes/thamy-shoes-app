import { describe, it, expect } from 'vitest'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../rate-limit'

// Prefixo único por describe para isolar os testes (map em memória persiste no módulo)
const key = (suffix: string) => `test:rate-limit:${suffix}:${Date.now()}`

describe('rateLimit', () => {
  it('permite requisições dentro do limite', () => {
    const k = key('allow')
    const config = { interval: 60_000, maxRequests: 3 }

    const r1 = rateLimit(k, config)
    const r2 = rateLimit(k, config)
    const r3 = rateLimit(k, config)

    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(2)
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(1)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('bloqueia após atingir o limite', () => {
    const k = key('block')
    const config = { interval: 60_000, maxRequests: 2 }

    rateLimit(k, config)
    rateLimit(k, config)
    const blocked = rateLimit(k, config)

    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('retorna data de reset válida', () => {
    const k = key('reset')
    const config = { interval: 60_000, maxRequests: 5 }
    const before = new Date()

    const result = rateLimit(k, config)

    expect(result.reset).toBeInstanceOf(Date)
    expect(result.reset.getTime()).toBeGreaterThan(before.getTime())
  })

  it('reinicia o contador após o intervalo expirar', async () => {
    const k = key('expire')
    const config = { interval: 50, maxRequests: 1 }

    const r1 = rateLimit(k, config)
    expect(r1.success).toBe(true)

    const blocked = rateLimit(k, config)
    expect(blocked.success).toBe(false)

    // Aguardar expiração
    await new Promise((resolve) => setTimeout(resolve, 60))

    const r3 = rateLimit(k, config)
    expect(r3.success).toBe(true)
  })

  it('usa chaves independentes para IPs diferentes', () => {
    const config = { interval: 60_000, maxRequests: 1 }

    const ip1 = rateLimit(key('ip1'), config)
    const ip2 = rateLimit(key('ip2'), config)

    expect(ip1.success).toBe(true)
    expect(ip2.success).toBe(true)
  })
})

describe('RATE_LIMIT_CONFIGS', () => {
  it('define config de login com 5 req / 15min', () => {
    expect(RATE_LIMIT_CONFIGS.login.maxRequests).toBe(5)
    expect(RATE_LIMIT_CONFIGS.login.interval).toBe(15 * 60 * 1000)
  })

  it('define config de import com 60 req / min', () => {
    expect(RATE_LIMIT_CONFIGS.import.maxRequests).toBe(60)
    expect(RATE_LIMIT_CONFIGS.import.interval).toBe(60 * 1000)
  })

  it('define config de fichas com 30 req / min', () => {
    expect(RATE_LIMIT_CONFIGS.fichas.maxRequests).toBe(30)
    expect(RATE_LIMIT_CONFIGS.fichas.interval).toBe(60 * 1000)
  })

  it('define config de bling com 3 req / s', () => {
    expect(RATE_LIMIT_CONFIGS.bling.maxRequests).toBe(3)
    expect(RATE_LIMIT_CONFIGS.bling.interval).toBe(1000)
  })
})
