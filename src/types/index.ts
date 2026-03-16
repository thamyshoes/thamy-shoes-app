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
  Material,
  Modelo,
  ModeloVarianteCor,
} from '@prisma/client'

export {
  Perfil,
  Setor,
  StatusPedido,
  StatusItem,
  StatusConexao,
  EscopoEquivalencia,
  TipoCampo,
  CategoriaMaterial,
} from '@prisma/client'

// ── DTOs de usuário ─────────────────────────────────────────────────────────

export type UserPublic = Omit<import('@prisma/client').User, 'passwordHash'>

// ── DTOs de sessão ────────────────────────────────────────────────────────────

export interface UserSession {
  id: string
  email: string
  nome: string
  perfil: import('@prisma/client').Perfil
  setores: import('@prisma/client').Setor[]
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
  modeloNome?: string
  // Campos base do Modelo
  modeloCabedal?: string
  modeloSola?: string
  modeloPalmilha?: string
  modeloFacheta?: string
  // Materiais do Modelo (fichas-v2)
  materialCabedal?: string
  materialSola?: string
  materialPalmilha?: string
  materialFacheta?: string
  // Campos de variante por cor
  imagemUrl?: string
  corCabedal?: string
  corSola?: string
  corPalmilha?: string
  corFacheta?: string
  // Identificação
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
