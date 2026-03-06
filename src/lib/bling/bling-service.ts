import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { encrypt, decrypt } from '@/lib/bling/bling-crypto'
import { CircuitBreaker, CircuitOpenError } from '@/lib/bling/circuit-breaker'
import { TIMING, MESSAGES } from '@/lib/constants'
import { StatusConexao } from '@/types'

// ── Tipos da API Bling v3 ─────────────────────────────────────────────────────

export interface BlingItemVariacao {
  id: number
  nome: string
  valor: string
}

export interface BlingItemPedido {
  id: number
  descricao: string
  sku?: string
  quantidade: number
  unidade: string
  variacoes?: BlingItemVariacao[]
}

export interface BlingPedido {
  id: number
  numero: string
  dataCompra: string
  dataPrevista?: string
  fornecedor?: { id: number; nome: string }
  observacoes?: string
  observacoesInternas?: string
  situacao?: { id: number; valor: string }
  itens: BlingItemPedido[]
}

export type BlingPedidoDetalhe = BlingPedido

// ── Erros ─────────────────────────────────────────────────────────────────────

export class BlingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: number,
  ) {
    super(message)
    this.name = 'BlingApiError'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BLING_BASE_URL = 'https://www.bling.com.br/Api/v3'
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000 // 5 minutos

// ── Service ───────────────────────────────────────────────────────────────────

class BlingIntegrationService {
  private readonly circuitBreaker = new CircuitBreaker()
  private lastRequestTime = 0

  /** Exposto para spy em testes */
  protected _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Rate limiting: garante pelo menos 334ms entre requisições (3 req/s)
   */
  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < TIMING.BLING_RATE_LIMIT_MS) {
      await this._sleep(TIMING.BLING_RATE_LIMIT_MS - elapsed)
    }
    this.lastRequestTime = Date.now()
  }

  /**
   * Obtém access token válido. Executa refresh automático se necessário.
   */
  async getValidToken(): Promise<string> {
    const connection = await prisma.blingConnection.findFirst()

    if (!connection || connection.status === StatusConexao.DESCONECTADO) {
      throw new Error(MESSAGES.ERROR.TOKEN_EXPIRED)
    }

    // Retornar token se ainda válido com margem de segurança
    const timeUntilExpiry = connection.expiresAt.getTime() - Date.now()
    if (timeUntilExpiry >= TOKEN_REFRESH_MARGIN_MS) {
      return decrypt(connection.accessToken)
    }

    // Token expirado ou prestes a expirar: refresh
    try {
      if (!env.BLING_CLIENT_ID || !env.BLING_CLIENT_SECRET) {
        throw new Error('Bling não configurado')
      }

      const refreshToken = decrypt(connection.refreshToken)
      const credentials = Buffer.from(
        `${env.BLING_CLIENT_ID}:${env.BLING_CLIENT_SECRET}`,
      ).toString('base64')

      const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!res.ok) {
        throw new Error(`Refresh failed: ${res.status}`)
      }

      const data = (await res.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }

      const expiresAt = new Date(Date.now() + data.expires_in * 1000)

      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encrypt(data.access_token),
          refreshToken: encrypt(data.refresh_token),
          expiresAt,
          status: StatusConexao.CONECTADO,
        },
      })

      return data.access_token
    } catch {
      // Refresh falhou: marcar como EXPIRADO
      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: { status: StatusConexao.EXPIRADO },
      })
      throw new Error(MESSAGES.ERROR.TOKEN_EXPIRED)
    }
  }

  /**
   * Executa request à API Bling com rate limiting, circuit breaker e retry.
   */
  private async blingRequest<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const retryableStatuses = new Set([429, 500, 502, 503, 504])
    const retryDelays = [1000, 2000, 4000]
    let lastError: unknown

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        await this.rateLimit()
        const token = await this.getValidToken()

        return await this.circuitBreaker.execute(async () => {
          const res = await fetch(`${BLING_BASE_URL}${path}`, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          })

          if (!res.ok) {
            const retryAfter =
              res.status === 429
                ? parseInt(res.headers.get('Retry-After') ?? '0', 10) || undefined
                : undefined
            throw new BlingApiError(`Bling API error ${res.status}`, res.status, retryAfter)
          }

          return res.json() as T
        })
      } catch (err) {
        lastError = err

        // Não retentar se for o último attempt
        if (attempt >= retryDelays.length) break

        if (err instanceof CircuitOpenError) {
          // Circuito aberto: não retentar
          break
        }

        if (err instanceof BlingApiError) {
          // Não retentar erros não-retentáveis
          if (!retryableStatuses.has(err.status)) break
          // Usar Retry-After se fornecido, senão backoff exponencial
          const delay = err.retryAfter ? err.retryAfter * 1000 : retryDelays[attempt]!
          await this._sleep(delay)
        } else if (
          err instanceof TypeError ||
          (err instanceof Error && err.message.includes('ECONNRESET'))
        ) {
          // Erro de rede: retentar com backoff
          await this._sleep(retryDelays[attempt]!)
        } else {
          // Erro não-retentável (ex: token expirado)
          break
        }
      }
    }

    throw lastError
  }

  async listPedidosCompra(
    dias: number,
    pagina = 1,
  ): Promise<{ data: BlingPedido[]; hasMore: boolean }> {
    const limite = 10
    const now = new Date()
    const dataInicial = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().split('T')[0]!

    const params = new URLSearchParams({
      dataInicial: fmt(dataInicial),
      dataFinal: fmt(now),
      pagina: String(pagina),
      limite: String(limite),
    })

    const response = await this.blingRequest<{ data: BlingPedido[] }>(
      'GET',
      `/pedidos/compras?${params.toString()}`,
    )

    return { data: response.data, hasMore: response.data.length === limite }
  }

  async getPedidoCompra(idBling: number): Promise<BlingPedidoDetalhe> {
    const response = await this.blingRequest<{ data: BlingPedidoDetalhe }>(
      'GET',
      `/pedidos/compras/${idBling}`,
    )
    return response.data
  }

  async checkConnection(): Promise<{ connected: boolean; expiresAt: Date | null }> {
    const connection = await prisma.blingConnection.findFirst()
    if (!connection || connection.status === StatusConexao.DESCONECTADO) {
      return { connected: false, expiresAt: null }
    }
    return {
      connected: connection.status === StatusConexao.CONECTADO,
      expiresAt: connection.expiresAt,
    }
  }
}

// Singleton com persistência em globalThis (evita criar nova instância a cada hot-reload)
const globalForBling = globalThis as unknown as { blingService: BlingIntegrationService }
export const blingService =
  globalForBling.blingService ?? new BlingIntegrationService()

if (process.env.NODE_ENV !== 'production') {
  globalForBling.blingService = blingService
}

export { BlingIntegrationService }
