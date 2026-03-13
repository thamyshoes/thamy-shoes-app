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
}

export interface ModeloData {
  codigo?: string | null
  materialCabedal?: string | null
  materialSola?: string | null
  materialPalmilha?: string | null
  materialFacheta?: string | null
  facheta?: string | null
}

export interface ItemData {
  sku: string
  modelo: ModeloData
  variante: VarianteData
  quantidades: Record<number, number>
}
