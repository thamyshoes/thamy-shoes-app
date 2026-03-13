import { prisma } from '@/lib/prisma'
import type { ItemPedido } from '@prisma/client'
import type { GradeRow, ItemInterpretado } from '@/types'
import { StatusItem } from '@/types'

// ── Tipos internos ────────────────────────────────────────────────────────────

interface SkuParseResult {
  modelo: string | null
  cor: string | null
  tamanho: string | null
  status: StatusItem
}

interface DigitosSegmento {
  campo: string
  digitos: number
}

interface CachedRegra {
  modo: string
  separador: string
  ordem: string[]
  digitosSufixo: DigitosSegmento[] | null
}

// ── Cache de regra ativa (por processo, revalidado sob demanda) ───────────────

let cachedRegra: CachedRegra | null | undefined = undefined

async function getRegraAtiva(): Promise<CachedRegra | null> {
  if (cachedRegra !== undefined) return cachedRegra

  const regra = await prisma.regraSkU.findFirst({ where: { ativa: true } })
  if (!regra) {
    cachedRegra = null
    return null
  }

  const modo = typeof regra.modo === 'string' ? regra.modo : 'SEPARADOR'
  const ordem = Array.isArray(regra.ordem) ? (regra.ordem as string[]) : []
  const digitosSufixo = Array.isArray(regra.digitosSufixo)
    ? (regra.digitosSufixo as unknown as DigitosSegmento[])
    : null

  cachedRegra = { modo, separador: regra.separador, ordem, digitosSufixo }
  return cachedRegra
}

/** Invalida o cache para forçar re-busca (útil após atualização de regra). */
export function invalidarCacheRegra(): void {
  cachedRegra = undefined
}

// ── Parsing por sufixo (direita para esquerda) ────────────────────────────────

function parseSkuSufixo(sku: string, digitos: DigitosSegmento[]): SkuParseResult {
  const mapa: Record<string, string> = {}
  let remaining = sku

  for (const seg of digitos) {
    if (remaining.length < seg.digitos) {
      return { modelo: null, cor: null, tamanho: null, status: StatusItem.PENDENTE }
    }
    mapa[seg.campo] = remaining.slice(-seg.digitos)
    remaining = remaining.slice(0, -seg.digitos)
  }

  mapa['modelo'] = remaining

  const modelo = mapa['modelo'] || null
  const cor = mapa['cor'] || null
  const tamanho = mapa['tamanho'] || null
  const resolvido = !!modelo && !!cor && !!tamanho

  return { modelo, cor, tamanho, status: resolvido ? StatusItem.RESOLVIDO : StatusItem.PENDENTE }
}

// ── ST001: parseSku ───────────────────────────────────────────────────────────

export async function parseSku(skuBruto: string): Promise<SkuParseResult> {
  if (!skuBruto) {
    return { modelo: null, cor: null, tamanho: null, status: StatusItem.PENDENTE }
  }

  const regra = await getRegraAtiva()
  if (!regra) {
    return { modelo: null, cor: null, tamanho: null, status: StatusItem.PENDENTE }
  }

  if (regra.modo === 'SUFIXO' && regra.digitosSufixo) {
    return parseSkuSufixo(skuBruto, regra.digitosSufixo)
  }

  // Modo SEPARADOR (original)
  const segmentos = skuBruto.split(regra.separador)
  const mapa: Record<string, string> = {}

  regra.ordem.forEach((campo, idx) => {
    if (idx < segmentos.length) {
      mapa[campo] = segmentos[idx]!
    }
  })

  const modelo = mapa['modelo'] ?? null
  const cor = mapa['cor'] ?? null
  const tamanho = mapa['tamanho'] ?? null
  const resolvido = regra.ordem.every((campo) => mapa[campo] != null)

  return { modelo, cor, tamanho, status: resolvido ? StatusItem.RESOLVIDO : StatusItem.PENDENTE }
}

// ── Fallback: resolução por prefixo de Modelo cadastrado ─────────────────────

interface ModeloPrefixo {
  id: string
  codigo: string
}

async function resolverPorPrefixoModelo(
  skuBruto: string,
  modelosAtivos: ModeloPrefixo[],
  digitosSufixo: DigitosSegmento[] | null,
): Promise<SkuParseResult & { modeloDbId: string | null }> {
  const skuLimpo = skuBruto?.trim() ?? ''
  if (!skuLimpo || modelosAtivos.length === 0) {
    return { modelo: null, cor: null, tamanho: null, status: StatusItem.PENDENTE, modeloDbId: null }
  }

  // Ordenar por comprimento de código decrescente (maior prefixo primeiro)
  const sorted = [...modelosAtivos].sort((a, b) => b.codigo.length - a.codigo.length)

  for (const m of sorted) {
    if (!skuLimpo.startsWith(m.codigo)) continue

    const restante = skuLimpo.slice(m.codigo.length)
    if (restante.length === 0) continue

    // Tentar extrair cor+tamanho do restante usando a mesma lógica de dígitos
    if (digitosSufixo) {
      const result = parseSkuSufixo(m.codigo + restante, digitosSufixo)
      // Verificar se o resultado bate com o modelo encontrado
      if (result.modelo === m.codigo && result.cor && result.tamanho) {
        return { ...result, modeloDbId: m.id }
      }
    }

    // Fallback: últimos 2 dígitos = tamanho, restante = cor
    // Cor deve ser alfanumérica (sem separadores/lixo)
    if (restante.length >= 3 && /^[A-Za-z0-9]+$/.test(restante)) {
      const tamanho = restante.slice(-2)
      const cor = restante.slice(0, -2)
      const tamNum = parseInt(tamanho, 10)
      // Range 10-50 cobre calçados infantis (16-27) e adultos (33-45)
      if (!isNaN(tamNum) && tamNum >= 10 && tamNum <= 50 && cor.length > 0) {
        return {
          modelo: m.codigo,
          cor,
          tamanho,
          status: StatusItem.RESOLVIDO,
          modeloDbId: m.id,
        }
      }
    }
  }

  return { modelo: null, cor: null, tamanho: null, status: StatusItem.PENDENTE, modeloDbId: null }
}

// ── ST002: interpretarItens ───────────────────────────────────────────────────

export async function interpretarItens(itens: ItemPedido[]): Promise<ItemInterpretado[]> {
  if (itens.length === 0) return []

  const coresUnicas = new Set<string>()
  const resultados = await Promise.all(itens.map((item) => parseSku(item.skuBruto ?? '')))

  // Identificar itens pendentes para fallback
  const itensPendentes: number[] = []
  resultados.forEach((r, idx) => {
    if (r.cor) coresUnicas.add(r.cor)
    if (r.status === StatusItem.PENDENTE) itensPendentes.push(idx)
  })

  // Buscar modelos ativos para fallback e para enriquecimento
  const modelosAtivos = await prisma.modelo.findMany({
    where: { ativo: true },
    select: { id: true, codigo: true },
  })

  // Fallback por prefixo para itens que o parser não resolveu
  const regra = await getRegraAtiva()
  const fallbackResults = new Map<number, SkuParseResult & { modeloDbId: string | null }>()

  if (itensPendentes.length > 0 && modelosAtivos.length > 0) {
    await Promise.all(
      itensPendentes.map(async (idx) => {
        const skuBruto = itens[idx]!.skuBruto ?? ''
        const fallback = await resolverPorPrefixoModelo(
          skuBruto,
          modelosAtivos,
          regra?.digitosSufixo ?? null,
        )
        if (fallback.status === StatusItem.RESOLVIDO) {
          fallbackResults.set(idx, fallback)
          if (fallback.cor) coresUnicas.add(fallback.cor)
        }
      }),
    )
  }

  // Merge: usar fallback para itens que o parser não resolveu
  for (const [idx, fallback] of fallbackResults) {
    resultados[idx] = fallback
  }

  // Coletar modelos únicos (códigos string)
  const modelosUnicos = [...new Set(resultados.map((r) => r.modelo).filter(Boolean) as string[])]

  // Buscar Produto, MapeamentoCor, Modelo e ModeloVarianteCor em paralelo
  const [mapeamentos, produtos, modelosCadastrados] = await Promise.all([
    prisma.mapeamentoCor.findMany({ where: { codigo: { in: [...coresUnicas] } } }),
    modelosUnicos.length > 0
      ? prisma.produto.findMany({ where: { codigo: { in: modelosUnicos } }, select: { id: true, codigo: true } })
      : Promise.resolve([]),
    modelosUnicos.length > 0
      ? prisma.modelo.findMany({
          where: { codigo: { in: modelosUnicos } },
          select: { id: true, codigo: true, variantesCor: { select: { corCodigo: true } } },
        })
      : Promise.resolve([]),
  ])

  const mapaDescricao = new Map(mapeamentos.map((m) => [m.codigo, m.descricao]))
  const mapaProduto = new Map(produtos.map((p) => [p.codigo, p.id]))
  const mapaModelo = new Map(modelosCadastrados.map((m) => [m.codigo, m]))

  // Coletar cores sem mapeamento que existem como variante (para auto-criar em batch)
  const coresSemMapeamento = new Set<string>()
  for (const r of resultados) {
    if (r.modelo && r.cor && !mapaDescricao.has(r.cor)) {
      const modeloInfo = mapaModelo.get(r.modelo)
      if (modeloInfo?.variantesCor.some((v) => v.corCodigo === r.cor)) {
        coresSemMapeamento.add(r.cor)
      }
    }
  }

  // Auto-criar MapeamentoCor em batch (fora do loop por item)
  if (coresSemMapeamento.size > 0) {
    await Promise.all(
      [...coresSemMapeamento].map((codigo) =>
        prisma.mapeamentoCor.upsert({
          where: { codigo },
          update: {},
          create: { codigo, descricao: codigo },
        }).catch((err: unknown) => {
          // Ignorar apenas conflito de unique constraint (P2002)
          if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') return
          console.warn('[interpretarItens] Erro ao auto-criar MapeamentoCor:', codigo, err)
        }),
      ),
    )
  }

  const interpretados: ItemInterpretado[] = []

  await Promise.all(
    itens.map(async (item, idx) => {
      const r = resultados[idx]!
      const fallback = fallbackResults.get(idx)

      // Resolver corDescricao: MapeamentoCor primeiro, fallback para código
      const corDescricao = r.cor ? (mapaDescricao.get(r.cor) ?? r.cor) : ''
      const produtoId = r.modelo ? (mapaProduto.get(r.modelo) ?? null) : null

      // Resolver modeloId: do fallback ou do mapa de modelos cadastrados
      let modeloDbId: string | null = fallback?.modeloDbId ?? null
      if (!modeloDbId && r.modelo) {
        const modeloInfo = mapaModelo.get(r.modelo)
        modeloDbId = modeloInfo?.id ?? null
      }

      const tamanhoNumerico = r.tamanho ? parseInt(r.tamanho, 10) : null
      const tamanhoValido = tamanhoNumerico !== null && !isNaN(tamanhoNumerico)
      const statusFinal = r.status === StatusItem.RESOLVIDO && !tamanhoValido
        ? StatusItem.PENDENTE
        : r.status

      await prisma.itemPedido.update({
        where: { id: item.id },
        data: {
          modelo: r.modelo,
          cor: r.cor,
          corDescricao: corDescricao || null,
          tamanho: tamanhoValido ? tamanhoNumerico : null,
          status: statusFinal,
          produtoId,
          modeloId: modeloDbId,
        },
      })

      if (statusFinal === StatusItem.RESOLVIDO && r.modelo && r.cor && r.tamanho) {
        interpretados.push({
          modelo: r.modelo,
          cor: r.cor,
          corDescricao: corDescricao || r.cor,
          tamanho: r.tamanho,
          quantidade: item.quantidade,
          status: StatusItem.RESOLVIDO,
        })
      }
    }),
  )

  return interpretados
}

// ── Classificação de faixa de numeração ──────────────────────────────────────

function classificarFaixa(tamanho: number): string {
  return tamanho <= 27 ? 'INFANTIL' : 'ADULTO'
}

// ── ST003: montarGrades ───────────────────────────────────────────────────────

export async function montarGrades(pedidoId: string): Promise<GradeRow[]> {
  return montarGradesConsolidadas([pedidoId])
}

// ── ST004: montarGradesConsolidadas ───────────────────────────────────────────

export async function montarGradesConsolidadas(
  pedidoIds: string[],
  options?: { agruparPorFaixa?: boolean },
): Promise<GradeRow[]> {
  console.log('[montarGradesConsolidadas] pedidoIds:', pedidoIds)
  if (pedidoIds.length === 0) return []

  const itens = await prisma.itemPedido.findMany({
    where: {
      pedidoId: { in: pedidoIds },
      status: StatusItem.RESOLVIDO,
      modelo: { not: null },
      cor: { not: null },
      tamanho: { not: null },
    },
  })
  console.log('[montarGradesConsolidadas] Itens resolvidos encontrados:', itens.length)

  if (itens.length === 0) return []

  const modelos = [...new Set(itens.map((i) => i.modelo!).filter(Boolean))]
  console.log('[montarGradesConsolidadas] Modelos únicos:', modelos)
  const gradesModelo = await prisma.gradeModelo.findMany({
    where: { modelo: { in: modelos } },
    include: { grade: true },
  })
  console.log('[montarGradesConsolidadas] Grades encontradas:', gradesModelo.length)
  const modeloParaGrade = new Map(
    gradesModelo.map((gm) => [gm.modelo, gm.grade]),
  )

  const agruparPorFaixa = options?.agruparPorFaixa ?? false

  const grupos = new Map<string, {
    modelo: string
    cor: string
    corDescricao: string
    faixa?: string
    tamanhos: Map<number, number>
    grade?: { tamanhoMin: number; tamanhoMax: number }
  }>()

  for (const item of itens) {
    const faixa = agruparPorFaixa ? classificarFaixa(item.tamanho!) : undefined
    const key = faixa ? `${item.modelo}||${item.cor}||${faixa}` : `${item.modelo}||${item.cor}`
    if (!grupos.has(key)) {
      const grade = modeloParaGrade.get(item.modelo!)
      grupos.set(key, {
        modelo: item.modelo!,
        cor: item.cor!,
        corDescricao: item.corDescricao ?? item.cor!,
        faixa,
        tamanhos: new Map(),
        grade: grade ? { tamanhoMin: grade.tamanhoMin, tamanhoMax: grade.tamanhoMax } : undefined,
      })
    }
    const grupo = grupos.get(key)!
    const tam = item.tamanho!
    grupo.tamanhos.set(tam, (grupo.tamanhos.get(tam) ?? 0) + item.quantidade)
  }

  // Buscar dados dos modelos cadastrados (incluindo variantes por cor)
  const modeloCodes = [...new Set([...grupos.values()].map((g) => g.modelo))]
  let modelosCadastrados: {
    codigo: string
    nome: string | null
    cabedal: string | null
    sola: string | null
    palmilha: string | null
    facheta?: string | null
    materialCabedal?: string | null
    materialSola?: string | null
    materialPalmilha?: string | null
    materialFacheta?: string | null
    variantesCor?: { corCodigo: string; imagemUrl: string | null; corCabedal: string | null; corSola: string | null; corPalmilha: string | null; corFacheta: string | null }[]
  }[] = []

  if (modeloCodes.length > 0) {
    try {
      console.log('[montarGradesConsolidadas] Buscando modelos com campos novos...')
      modelosCadastrados = await prisma.modelo.findMany({
        where: { codigo: { in: modeloCodes } },
        select: {
          codigo:           true,
          nome:             true,
          cabedal:          true,
          sola:             true,
          palmilha:         true,
          facheta:          true,
          materialCabedal:  true,
          materialSola:     true,
          materialPalmilha: true,
          materialFacheta:  true,
          variantesCor:     true,
        },
      })
      console.log('[montarGradesConsolidadas] Modelos encontrados (com variantes):', modelosCadastrados.length)
    } catch (queryErr) {
      // Fallback: migration não aplicada ainda, buscar sem campos novos
      console.warn('[montarGradesConsolidadas] Fallback sem campos novos. Erro:', queryErr instanceof Error ? queryErr.message : queryErr)
      modelosCadastrados = await prisma.modelo.findMany({
        where: { codigo: { in: modeloCodes } },
        select: { codigo: true, nome: true, cabedal: true, sola: true, palmilha: true },
      })
      console.log('[montarGradesConsolidadas] Modelos encontrados (fallback):', modelosCadastrados.length)
    }
  }
  const modeloMapa = new Map(modelosCadastrados.map((m) => [m.codigo, m]))

  const rows: GradeRow[] = []

  for (const grupo of grupos.values()) {
    const allTamanhos = grupo.grade
      ? buildTamanhoRange(grupo.grade.tamanhoMin, grupo.grade.tamanhoMax)
      : [...grupo.tamanhos.keys()].sort((a, b) => a - b)

    const tamanhoSet = grupo.faixa
      ? allTamanhos.filter((t) => classificarFaixa(t) === grupo.faixa)
      : allTamanhos

    const tamanhos: Record<string, number> = {}
    let total = 0

    for (const tam of tamanhoSet) {
      const qty = grupo.tamanhos.get(tam) ?? 0
      tamanhos[String(tam)] = qty
      total += qty
    }

    const modeloInfo = modeloMapa.get(grupo.modelo)

    // Buscar variante específica para esta cor (pode não existir se migration não aplicada)
    const variante = modeloInfo?.variantesCor?.find((v) => v.corCodigo === grupo.cor)

    rows.push({
      modelo: grupo.faixa ? `${grupo.modelo} (${grupo.faixa})` : grupo.modelo,
      modeloNome:       modeloInfo?.nome      ?? undefined,
      modeloCabedal:    modeloInfo?.cabedal   ?? undefined,
      modeloSola:       modeloInfo?.sola      ?? undefined,
      modeloPalmilha:   modeloInfo?.palmilha  ?? undefined,
      modeloFacheta:    modeloInfo?.facheta   ?? undefined,
      // Materiais do modelo
      materialCabedal:  modeloInfo?.materialCabedal  ?? undefined,
      materialSola:     modeloInfo?.materialSola      ?? undefined,
      materialPalmilha: modeloInfo?.materialPalmilha  ?? undefined,
      materialFacheta:  modeloInfo?.materialFacheta   ?? undefined,
      // Dados de variante por cor
      imagemUrl:        variante?.imagemUrl   ?? undefined,
      corCabedal:       variante?.corCabedal  ?? undefined,
      corSola:          variante?.corSola     ?? undefined,
      corPalmilha:      variante?.corPalmilha ?? undefined,
      corFacheta:       variante?.corFacheta  ?? undefined,
      cor:              grupo.cor,
      corDescricao:     grupo.corDescricao,
      tamanhos,
      totalPares: total,
    })
  }

  return rows
}

function buildTamanhoRange(min: number, max: number): number[] {
  const range: number[] = []
  for (let t = min; t <= max; t++) range.push(t)
  return range
}
