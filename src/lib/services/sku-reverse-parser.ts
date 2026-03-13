/**
 * SkuReverseParser — interpreta SKU no formato {modelo}{cor3d}{tamanho2d}
 *
 * Regra fixa:
 *   - 2 últimos chars → tamanho
 *   - 3 chars anteriores → cor
 *   - restante → código do modelo
 *
 * Mínimo de 5 chars para extrair cor + tamanho.
 * Se SKU < 5 chars → modelo = SKU inteiro, cor/tamanho = null.
 */

export interface ParsedSku {
  modelo: string
  cor: string | null
  tamanho: string | null
}

export function parseSku(sku: string | null | undefined): ParsedSku {
  if (!sku) {
    return { modelo: '', cor: null, tamanho: null }
  }

  if (sku.length < 5) {
    return { modelo: sku, cor: null, tamanho: null }
  }

  const tamanho = sku.slice(-2)
  const cor = sku.slice(-5, -2)
  const modelo = sku.slice(0, -5)

  return { modelo, cor, tamanho }
}
