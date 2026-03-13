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
