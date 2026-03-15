export const ROUTES = {
  LOGIN: '/login',
  RESET_SENHA: '/reset-senha',
  PEDIDOS: '/pedidos',
  PEDIDOS_IMPORTAR: '/pedidos/importar',
  PEDIDO_DETALHE: (id: string) => `/pedidos/${id}`,
  FICHAS: '/fichas',
  PEDIDOS_CONSOLIDAR: '/pedidos/consolidar',
  CONFIGURACOES: '/configuracoes',
  MAPEAMENTO_SKU: '/mapeamento-sku',
  CONFIG_BLING: '/configuracoes/bling',
  CONFIG_SKU: '/configuracoes/sku',
  CONFIG_CORES: '/configuracoes/cores',
  CONFIG_GRADES: '/configuracoes/grades',
  CONFIG_EQUIVALENCIAS: '/configuracoes/equivalencias',
  CONFIG_CAMPOS_EXTRAS: '/configuracoes/campos-extras',
  CONFIG_MODELOS: '/configuracoes/modelos',
  CONFIG_MATERIA_PRIMA_CABEDAL: '/configuracoes/materia-prima/cabedal',
  CONFIG_MATERIA_PRIMA_SOLA: '/configuracoes/materia-prima/sola',
  CONFIG_MATERIA_PRIMA_PALMILHA: '/configuracoes/materia-prima/palmilha',
  CONFIG_MATERIA_PRIMA_FACHETA: '/configuracoes/materia-prima/facheta',
  USUARIOS: '/usuarios',
  PRODUTOS: '/produtos',
  PRODUTOS_IMPORTAR: '/produtos/importar',
} as const

export const API_ROUTES = {
  AUTH_LOGIN: '/api/auth/login',
  AUTH_ME: '/api/auth/me',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_FORGOT: '/api/auth/forgot',
  AUTH_RESET: '/api/auth/reset',
  USUARIOS: '/api/usuarios',
  USUARIO_DETALHE: (id: string) => `/api/usuarios/${id}`,
  BLING_STATUS: '/api/bling/status',
  BLING_CONNECT: '/api/bling/connect',
  BLING_CALLBACK: '/api/bling/callback',
  BLING_DISCONNECT: '/api/bling/disconnect',
  BLING_PEDIDOS: '/api/bling/pedidos',
  PEDIDOS: '/api/pedidos',
  PEDIDO_DETALHE: (id: string) => `/api/pedidos/${id}`,
  PEDIDOS_IMPORTAR: '/api/pedidos/importar',
  FICHAS_GERAR: '/api/fichas/gerar',
  FICHAS_CONSOLIDAR: '/api/fichas/consolidar',
  FICHAS: '/api/fichas',
  FICHA_DOWNLOAD_V2: (id: string) => `/api/fichas/download/${id}`,
  VARIANTES_BATCH: '/api/variantes/batch',
  STORAGE_SIGNED_URL: '/api/variantes/signed-url',
  MODELOS_VERIFICAR_VARIANTES: '/api/modelos/verificar-variantes',
  REGRAS_SKU: '/api/configuracoes/regras-sku',
  MAPEAMENTO_CORES: '/api/configuracoes/cores',
  GRADES: '/api/configuracoes/grades',
  EQUIVALENCIAS: '/api/configuracoes/equivalencias',
  CAMPOS_EXTRAS: '/api/configuracoes/campos-extras',
  MODELOS: '/api/configuracoes/modelos',
  VARIANTES_SYNC_BLING: '/api/configuracoes/modelos/variantes/sync-bling',
  MATERIAIS: '/api/configuracoes/materiais',
  REFERENCIAS: '/api/configuracoes/referencias',
  BLING_PRODUTOS: '/api/bling/produtos',
  PRODUTOS_IMPORTAR: '/api/produtos/importar',
  PRODUTOS: '/api/produtos',
} as const

export const MESSAGES = {
  SUCCESS: {
    SAVED: 'Salvo com sucesso',
    DELETED: 'Removido com sucesso',
    IMPORTED: 'Pedido importado com sucesso',
    FICHAS_GENERATED: 'Fichas geradas com sucesso',
    CONNECTED: 'Bling conectado com sucesso',
    DISCONNECTED: 'Bling desconectado',
  },
  ERROR: {
    GENERIC: 'Ocorreu um erro. Tente novamente.',
    NOT_FOUND: 'Registro não encontrado',
    UNAUTHORIZED: 'Sessão expirada. Faça login novamente.',
    FORBIDDEN: 'Sem permissão para esta ação',
    BLING_OFFLINE: 'Bling indisponível. Tente novamente depois.',
    TOKEN_EXPIRED: 'Token Bling expirado. Reconecte.',
    RATE_LIMIT: 'Sistema sobrecarregado. Tentando novamente...',
    IMPORT_DUPLICATE: 'Pedido já foi importado',
  },
  CONFIRM: {
    DELETE: 'Tem certeza que deseja remover?',
    DISCONNECT: 'Desconectar do Bling? Será necessário reconectar.',
    REIMPORT: 'Reimportar atualizará os dados. Fichas existentes podem divergir.',
    GERAR_FICHAS:
      'Gerar fichas de produção para este pedido? Serão criadas 3 fichas (Cabedal, Palmilha, Sola).',
  },
} as const

export const NOTIFICATION_TYPES = {
  TOKEN_EXPIRING_SOON: 'TOKEN_EXPIRING_SOON',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
} as const

export const SETOR_LABELS: Record<string, string> = {
  CABEDAL: 'Cabedal',
  PALMILHA: 'Palmilha',
  SOLA: 'Sola',
  FACHETA: 'Facheta',
} as const

export const LIMITS = {
  PAGE_SIZE: 20,
  MAX_CONSOLIDATION: 100,
  PDF_MAX_MB: 5,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,
  QUERY_TIMEOUT_S: 30,
} as const

export const TIMING = {
  DEBOUNCE_MS: 300,
  SESSION_TIMEOUT_MIN: 30,
  JWT_TTL_H: 24,
  TOAST_DURATION_MS: 5000,
  BLING_RATE_LIMIT_MS: 334,
} as const
