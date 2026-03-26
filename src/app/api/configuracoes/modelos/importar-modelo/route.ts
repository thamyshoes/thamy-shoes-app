import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { blingService } from '@/lib/bling/bling-service'
import { parseSku } from '@/lib/bling/sku-parser'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

// Timeout maior para busca no Bling
export const maxDuration = 30

// ── GET: Buscar produtos no Bling por código de modelo ──────────────────────

// GET /api/configuracoes/modelos/importar-modelo?codigo=3073
// Busca produtos no Bling cujo código começa com o modelo informado,
// parseia via SUFIXO e retorna lista agrupada de variantes encontradas.
export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const codigo = request.nextUrl.searchParams.get('codigo')?.trim()
  if (!codigo || codigo.length < 3) {
    return NextResponse.json(
      { error: 'Código deve ter pelo menos 3 caracteres' },
      { status: 400 },
    )
  }

  try {
    // Buscar no Bling
    const produtos = await blingService.searchProdutosByCodigo(codigo)

    if (produtos.length === 0) {
      return NextResponse.json({ items: [], modelo: codigo, total: 0 })
    }

    // Parsear cada SKU e filtrar apenas os que resultam no modelo buscado
    const items: {
      skuBling: string
      nomeBling: string
      modelo: string
      cor: string
      tamanho: string
      imagemUrl: string | null
    }[] = []

    for (const p of produtos) {
      const parsed = await parseSku(p.codigo)
      if (!parsed.modelo || !parsed.cor || !parsed.tamanho) continue
      // Filtrar: só incluir se o modelo parseado bate com o código buscado
      if (parsed.modelo !== codigo) continue

      items.push({
        skuBling: p.codigo,
        nomeBling: p.nome,
        modelo: parsed.modelo,
        cor: parsed.cor,
        tamanho: parsed.tamanho,
        imagemUrl: p.imagemThumbnail ?? null,
      })
    }

    // Agrupar por cor (para exibir variantes agrupadas)
    const coresMap = new Map<string, {
      cor: string
      tamanhos: string[]
      skus: string[]
      nome: string
      imagemUrl: string | null
    }>()

    for (const item of items) {
      if (!coresMap.has(item.cor)) {
        coresMap.set(item.cor, {
          cor: item.cor,
          tamanhos: [],
          skus: [],
          nome: item.nomeBling,
          imagemUrl: item.imagemUrl,
        })
      }
      const grupo = coresMap.get(item.cor)!
      grupo.tamanhos.push(item.tamanho)
      grupo.skus.push(item.skuBling)
    }

    // Verificar se o modelo já existe no banco
    const modeloExistente = await prisma.modelo.findUnique({
      where: { codigo },
      select: { id: true, variantesCor: { select: { corCodigo: true } } },
    })

    const coresJaCadastradas = new Set(modeloExistente?.variantesCor.map((v) => v.corCodigo) ?? [])

    const variantes = [...coresMap.values()]
      .map((v) => ({
        ...v,
        tamanhos: v.tamanhos.sort((a, b) => Number(a) - Number(b)),
        totalSkus: v.skus.length,
        jaCadastrada: coresJaCadastradas.has(v.cor),
      }))
      .sort((a, b) => a.cor.localeCompare(b.cor))

    // Buscar descrições das cores
    const corCodigos = variantes.map((v) => v.cor)
    const mapeamentos = await prisma.mapeamentoCor.findMany({
      where: { codigo: { in: corCodigos } },
      select: { codigo: true, descricao: true },
    })
    const corDescMap = new Map(mapeamentos.map((m) => [m.codigo, m.descricao]))

    return NextResponse.json({
      modelo: codigo,
      modeloExiste: !!modeloExistente,
      total: items.length,
      variantes: variantes.map((v) => ({
        ...v,
        corDescricao: corDescMap.get(v.cor) ?? v.cor,
      })),
    })
  } catch (err) {
    console.error('[importar-modelo] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar no Bling' },
      { status: 500 },
    )
  }
}

// ── POST: Importar modelo e variantes selecionadas ──────────────────────────

const importSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  cores: z.array(z.string()).min(1, 'Selecione pelo menos uma variante'),
})

// POST /api/configuracoes/modelos/importar-modelo
// Cria o modelo (se não existe) e as variantes de cor selecionadas.
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { codigo, nome, cores } = parsed.data

  try {
    // Upsert do modelo
    const modelo = await prisma.modelo.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nome },
      select: { id: true, codigo: true },
    })

    // Criar variantes de cor (upsert para evitar duplicatas)
    let variantesCriadas = 0
    for (const corCodigo of cores) {
      const existente = await prisma.modeloVarianteCor.findUnique({
        where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo } },
      })
      if (!existente) {
        await prisma.modeloVarianteCor.create({
          data: { modeloId: modelo.id, corCodigo },
        })
        variantesCriadas++
      }
    }

    // Auto-criar MapeamentoCor para cores sem mapeamento
    const coresExistentes = await prisma.mapeamentoCor.findMany({
      where: { codigo: { in: cores } },
      select: { codigo: true },
    })
    const coresJaMapeadas = new Set(coresExistentes.map((c) => c.codigo))
    const coresSemMapeamento = cores.filter((c) => !coresJaMapeadas.has(c))

    if (coresSemMapeamento.length > 0) {
      await Promise.all(
        coresSemMapeamento.map((codigo) =>
          prisma.mapeamentoCor.upsert({
            where: { codigo },
            update: {},
            create: { codigo, descricao: codigo },
          }).catch(() => {}),
        ),
      )
    }

    return NextResponse.json({
      modelo: modelo.codigo,
      modeloId: modelo.id,
      variantesCriadas,
      totalCores: cores.length,
    }, { status: 201 })
  } catch (err) {
    console.error('[importar-modelo] Erro ao importar:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao importar modelo' },
      { status: 500 },
    )
  }
}
