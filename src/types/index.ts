// Re-export tipos do Prisma
export type {
  User,
  BlingConnection,
  PedidoCompra,
  ItemPedido,
  RegraSkU,
  MapeamentoCor,
  GradeNumeracao,
  GradeModelo,
  RegraEquivalencia,
  FichaProducao,
  Consolidado,
  ConsolidadoPedido,
  CampoExtra,
  NotificacaoLog,
} from '@prisma/client'

export {
  Perfil,
  Setor,
  StatusPedido,
  StatusItem,
  StatusConexao,
  EscopoEquivalencia,
  TipoCampo,
} from '@prisma/client'

// ── DTOs de usuário ─────────────────────────────────────────────────────────

export type UserPublic = Omit<import('@prisma/client').User, 'passwordHash'>

// ── DTOs de sessão ────────────────────────────────────────────────────────────

export interface UserSession {
  id: string
  email: string
  nome: string
  perfil: import('@prisma/client').Perfil
  setor: import('@prisma/client').Setor | null
}

// ── DTOs de resposta de API ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── DTOs de domínio ───────────────────────────────────────────────────────────

export interface GradeRow {
  modelo: string
  cor: string
  corDescricao: string
  tamanhos: Record<string, number>
  totalPares: number
}

export interface ItemInterpretado {
  modelo: string
  cor: string
  corDescricao: string
  tamanho: string
  quantidade: number
  status: import('@prisma/client').StatusItem
}
