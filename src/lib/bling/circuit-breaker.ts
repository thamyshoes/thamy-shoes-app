export class CircuitOpenError extends Error {
  constructor() {
    super('Bling indisponível. Tente novamente mais tarde.')
    this.name = 'CircuitOpenError'
  }
}

/**
 * Circuit Breaker: closed → open (após 5 falhas em 60s) → cooldown 120s → half-open → closed
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureAt: number | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  private readonly threshold = 5
  private readonly windowMs = 60_000
  private readonly cooldownMs = 120_000

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = this.lastFailureAt ? Date.now() - this.lastFailureAt : Infinity
      if (elapsed >= this.cooldownMs) {
        this.state = 'half-open'
      } else {
        throw new CircuitOpenError()
      }
    }

    try {
      const result = await fn()
      if (this.state === 'half-open') {
        this.reset()
      }
      return result
    } catch (err) {
      this.recordFailure()
      throw err
    }
  }

  private recordFailure(): void {
    const now = Date.now()

    // Se estiver em half-open, qualquer falha abre imediatamente
    if (this.state === 'half-open') {
      this.failures = this.threshold
      this.lastFailureAt = now
      this.state = 'open'
      return
    }

    // Reset contador se última falha foi fora da janela
    if (this.lastFailureAt !== null && now - this.lastFailureAt > this.windowMs) {
      this.failures = 0
    }

    this.failures++
    this.lastFailureAt = now

    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }

  private reset(): void {
    this.failures = 0
    this.lastFailureAt = null
    this.state = 'closed'
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state
  }
}
