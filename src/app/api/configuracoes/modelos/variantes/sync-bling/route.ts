import { NextRequest, NextResponse } from 'next/server'
import { blingService } from '@/lib/bling/bling-service'
import { parseSku } from '@/lib/bling/sku-parser'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

export interface SyncBlingResult {
  criadas: number
  atualizadas: number
  semModelo: number
  semImagem: number
  erros: string[]
}

// POST /api/configuracoes/modelos/variantes/sync-bling
// Percorre todos os produtos do Bling, extrai variações com imagem,
// faz parse do SKU e faz upsert de ModeloVarianteCor.imagemUrl.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = requireAdmin(request)
  if (guard) return guard

  let criadas = 0
  let atualizadas = 0
  let semModelo = 0
  let semImagem = 0
  const erros: string[] = []

  // Conjunto de pares "modeloCodigo:corCodigo" já processados.
  // Garante que a primeira variação com imagem para cada par seja usada
  // (variações de tamanhos diferentes compartilham o mesmo par).
  const processados = new Set<string>()

  // Percorre todas as páginas de produtos do Bling
  let pagina = 1
  let hasMore = true

  while (hasMore) {
    const { data: produtos, hasMore: more } = await blingService.listProdutos(pagina)
    hasMore = more
    pagina++

    for (const produto of produtos) {
      try {
        const detalhe = await blingService.getProduto(produto.id)

        if (!detalhe.variacoes?.length) continue

        for (const variacao of detalhe.variacoes) {
          if (!variacao.codigo) continue

          const imagemUrl = variacao.imagens?.[0]?.link ?? null
          if (!imagemUrl) {
            semImagem++
            continue
          }

          const parsed = await parseSku(variacao.codigo)
          if (!parsed.modelo || !parsed.cor) continue

          // Evitar processar o mesmo (modelo, cor) mais de uma vez
          const chave = `${parsed.modelo}:${parsed.cor}`
          if (processados.has(chave)) continue
          processados.add(chave)

          // Buscar Modelo pelo código
          const modelo = await prisma.modelo.findUnique({
            where: { codigo: parsed.modelo },
            select: { id: true },
          })

          if (!modelo) {
            semModelo++
            continue
          }

          // Verificar se já existe para contabilizar criadas vs atualizadas
          const existente = await prisma.modeloVarianteCor.findUnique({
            where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo: parsed.cor } },
            select: { id: true },
          })

          await prisma.modeloVarianteCor.upsert({
            where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo: parsed.cor } },
            update: { imagemUrl },
            create: { modeloId: modelo.id, corCodigo: parsed.cor, imagemUrl },
          })

          if (existente) {
            atualizadas++
          } else {
            criadas++
          }
        }
      } catch (err) {
        erros.push(
          `Produto ${produto.codigo}: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
        )
      }
    }
  }

  const result: SyncBlingResult = { criadas, atualizadas, semModelo, semImagem, erros }
  return NextResponse.json(result)
}
