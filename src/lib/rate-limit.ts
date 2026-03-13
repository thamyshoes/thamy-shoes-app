type RateLimitConfig = {
  interval: number  // ms
  maxRequests: number
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  success: boolean
  remaining: number
  reset: Date
}

// ── AVISO: Rate limiter em memória ────────────────────────────────────────────
// Este store usa um Map em memória. Em ambientes serverless (Vercel, AWS Lambda)
// cada instância tem seu próprio Map — múltiplas instâncias paralelas NÃO
// compartilham o estado. O limite não é global nesses cenários.
//
// Para produção com múltiplas instâncias, migrar para Redis:
//   - Upstash Redis (Edge Runtime compatible): https://upstash.com
//   - Substituir este Map por @upstash/ratelimit
//
// Em desenvolvimento e em deploys single-instance, o comportamento é correto.
const store = new Map<string, RateLimitEntry>()

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.interval
    store.set(key, { count: 1, resetAt })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      reset: new Date(resetAt),
    }
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      reset: new Date(entry.resetAt),
    }
  }

  entry.count++
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    reset: new Date(entry.resetAt),
  }
}

// ── Configurações padrão por rota ────────────────────────────────────────────

export const RATE_LIMIT_CONFIGS = {
  /** Login: 5 req / 15min por IP */
  login: { interval: 15 * 60 * 1000, maxRequests: 5 },

  /** Reset de senha: 5 req / 15min por IP */
  passwordReset: { interval: 15 * 60 * 1000, maxRequests: 5 },

  /** Importação de pedidos: 60 req / min por usuário */
  import: { interval: 60 * 1000, maxRequests: 60 },

  /** Geração de fichas: 30 req / min por usuário */
  fichas: { interval: 60 * 1000, maxRequests: 30 },

  /** Proxy Bling: 3 req / s por sistema */
  bling: { interval: 1000, maxRequests: 3 },

  /** Consolidado (geração de PDF): 10 req / min por IP */
  consolidar: { interval: 60 * 1000, maxRequests: 10 },
} satisfies Record<string, RateLimitConfig>

export type RateLimitConfigKey = keyof typeof RATE_LIMIT_CONFIGS
