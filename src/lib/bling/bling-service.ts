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
  quantidade: number
  unidade: string
  produto?: { id: number; codigo: string }
  variacoes?: BlingItemVariacao[]
}

export interface BlingPedido {
  id: number
  numero: number | string
  // Lista usa "data"; detalhe pode usar "dataCompra"
  data?: string
  dataCompra?: string
  dataPrevista?: string
  fornecedor?: { id: number; nome?: string }
  observacoes?: string
  observacoesInternas?: string
  situacao?: { valor: number | string }
  itens: BlingItemPedido[]
}

export interface BlingSituacao {
  id: number
  nome: string
  cor?: string
}

export interface BlingProduto {
  id: number
  nome: string
  codigo: string
  preco?: number
  situacao?: string       // "A" ativo, "I" inativo
  tipo?: string           // "P" produto, "S" serviço
  imagemThumbnail?: string
}

export interface BlingVariacaoImagem {
  id: number
  link: string
  validade?: string
}

export interface BlingVariacao {
  id: number
  nome: string
  codigo: string
  preco?: number
  imagens?: BlingVariacaoImagem[]
}

export interface BlingProdutoDetalhe extends BlingProduto {
  variacoes?: BlingVariacao[]
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
const REFRESH_TOKEN_TTL_DAYS = 30
const REFRESH_LOCK_TIMEOUT_MS = 30 * 1000 // 30s — se lock mais velho que isso, considerar stale

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
   * Inclui mutex via banco para evitar race condition com token rotation.
   */
  async getValidToken(): Promise<string> {
    const connection = await prisma.blingConnection.findFirst()

    if (!connection || connection.status === StatusConexao.DESCONECTADO) {
      throw new Error(MESSAGES.ERROR.TOKEN_EXPIRED)
    }

    // Se refresh_token expirou (30 dias), reconexão manual é obrigatória
    if (
      connection.refreshTokenExpiresAt &&
      connection.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: { status: StatusConexao.EXPIRADO },
      })
      throw new Error(MESSAGES.ERROR.TOKEN_EXPIRED)
    }

    // Retornar token se ainda válido com margem de segurança
    const timeUntilExpiry = connection.expiresAt.getTime() - Date.now()
    if (timeUntilExpiry >= TOKEN_REFRESH_MARGIN_MS) {
      return decrypt(connection.accessToken)
    }

    // Verificar se outro processo já está fazendo refresh (mutex)
    if (connection.isRefreshing && connection.refreshingAt) {
      const lockAge = Date.now() - connection.refreshingAt.getTime()
      if (lockAge < REFRESH_LOCK_TIMEOUT_MS) {
        // Aguardar e re-tentar (outro processo está fazendo refresh)
        await this._sleep(2000)
        return this.getValidToken()
      }
      // Lock stale — prosseguir com refresh
    }

    // Adquirir lock
    await prisma.blingConnection.update({
      where: { id: connection.id },
      data: { isRefreshing: true, refreshingAt: new Date() },
    })

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

      const now = Date.now()
      const expiresAt = new Date(now + data.expires_in * 1000)
      const refreshTokenExpiresAt = new Date(
        now + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      )

      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encrypt(data.access_token),
          refreshToken: encrypt(data.refresh_token),
          expiresAt,
          refreshTokenExpiresAt,
          status: StatusConexao.CONECTADO,
          isRefreshing: false,
          refreshingAt: null,
        },
      })

      return data.access_token
    } catch {
      // Liberar lock e marcar como EXPIRADO
      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: {
          status: StatusConexao.EXPIRADO,
          isRefreshing: false,
          refreshingAt: null,
        },
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

  async getContatoNome(idContato: number): Promise<string> {
    try {
      const response = await this.blingRequest<{ data: { id: number; nome: string; fantasia?: string } }>(
        'GET',
        `/contatos/${idContato}`,
      )
      return response.data.fantasia || response.data.nome || ''
    } catch (err) {
      console.warn(`[bling] Falha ao buscar contato ${idContato}:`, err instanceof Error ? err.message : err)
      return ''
    }
  }

  async getSituacoesCompra(): Promise<Map<number, string>> {
    const endpoints = ['/situacoes/pedidoCompra', '/situacoes/compras', '/situacoes/pedidosCompra']
    for (const endpoint of endpoints) {
      try {
        const response = await this.blingRequest<{ data: BlingSituacao[] }>('GET', endpoint)
        const key = (s: BlingSituacao) => s.nome ?? (s as unknown as Record<string, string>)['descricao'] ?? ''
        const map = new Map(response.data.map((s) => [s.id, key(s)]))
        if (map.size > 0) return map
      } catch {
        // Tentar próximo endpoint
      }
    }
    // Fallback: IDs confirmados via log desta conta Bling
    // valor 2 = "Em aberto" (confirmado pelo HTML da interface Bling)
    // Após reconectar o OAuth com o escopo de situações, este fallback não será usado
    return new Map([
      [2, 'Em aberto'],
    ])
  }

  async getProduto(id: number): Promise<BlingProdutoDetalhe> {
    const response = await this.blingRequest<{ data: BlingProdutoDetalhe }>(
      'GET',
      `/produtos/${id}`,
    )
    return response.data
  }

  /**
   * Lista produtos do Bling com paginação.
   * @param pagina Página (1-based)
   * @param criadosDesde Datetime "YYYY-MM-DD HH:MM:SS" — filtra por dataInclusaoInicial (data de CRIAÇÃO)
   */
  async listProdutos(pagina = 1, criadosDesde?: string): Promise<{ data: BlingProduto[]; hasMore: boolean }> {
    const limite = 100
    const params = new URLSearchParams({
      pagina: String(pagina),
      limite: String(limite),
      situacao: 'A',
    })

    if (criadosDesde) {
      params.set('dataInclusaoInicial', criadosDesde)
      const now = new Date()
      const fim = `${now.toISOString().split('T')[0]} 23:59:59`
      params.set('dataInclusaoFinal', fim)
    }

    const path = `/produtos?${params.toString()}`
    console.log(`[bling-sync] GET ${path}`)

    const response = await this.blingRequest<{ data: BlingProduto[] }>('GET', path)
    console.log(`[bling-sync] Página ${pagina}: ${response.data.length} produtos retornados`)
    return { data: response.data, hasMore: response.data.length === limite }
  }

  async checkConnection(): Promise<{
    connected: boolean
    expiresAt: Date | null
    refreshTokenExpiresAt: Date | null
  }> {
    const connection = await prisma.blingConnection.findFirst()
    if (!connection || connection.status === StatusConexao.DESCONECTADO) {
      return { connected: false, expiresAt: null, refreshTokenExpiresAt: null }
    }
    return {
      connected: connection.status === StatusConexao.CONECTADO,
      expiresAt: connection.expiresAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
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
