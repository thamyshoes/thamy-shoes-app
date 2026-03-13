/** Formata cor como "código - descrição" (ex: "298 - branco") */
export function formatCor(code: string | null | undefined, descricao: string): string {
  if (!code) return descricao
  if (code === descricao) return descricao
  return `${code} - ${descricao}`
}

export interface PedidoData {
  numero: string
  data: Date | string
}

export interface VarianteData {
  corPrincipal: string
  corCabedal?: string | null
  corSola?: string | null
  corPalmilha?: string | null
  corFacheta?: string | null
  // Descrições resolvidas via MapeamentoCor (cada cor do componente)
  corCabedalDesc?: string | null
  corSolaDesc?: string | null
  corPalmilhaDesc?: string | null
  corFachetaDesc?: string | null
  imagemBase64?: string | null
}

export interface ModeloData {
  codigo?: string | null
  // Referências de fornecedor por componente
  cabedal?: string | null
  sola?: string | null
  palmilha?: string | null
  facheta?: string | null
  // Materiais
  materialCabedal?: string | null
  materialSola?: string | null
  materialPalmilha?: string | null
  materialFacheta?: string | null
}

export interface ItemData {
  sku: string
  modelo: ModeloData
  variante: VarianteData
  quantidades: Record<number, number>
}
