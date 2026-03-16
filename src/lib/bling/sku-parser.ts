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
// Promise deduplication: evita N queries simultâneas no cold start
let loadingRegraPromise: Promise<CachedRegra | null> | null = null

async function getRegraAtiva(): Promise<CachedRegra | null> {
  if (cachedRegra !== undefined) return cachedRegra

  // Se já há uma busca em andamento, aguarda a mesma promise (não dispara nova query)
  if (!loadingRegraPromise) {
    loadingRegraPromise = prisma.regraSkU
      .findFirst({ where: { ativa: true } })
      .then((regra) => {
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
      })
      .finally(() => {
        loadingRegraPromise = null
      })
  }

  return loadingRegraPromise
}

/** Invalida o cache para forçar re-busca (útil após atualização de regra). */
export function invalidarCacheRegra(): void {
  cachedRegra = undefined
  loadingRegraPromise = null
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
  const resolvido = !!modelo && !!cor && !!tamanho

  return { modelo, cor, tamanho, status: resolvido ? StatusItem.RESOLVIDO : StatusItem.PENDENTE }
}

// ── ST002: interpretarItens ───────────────────────────────────────────────────

export async function interpretarItens(itens: ItemPedido[]): Promise<ItemInterpretado[]> {
  if (itens.length === 0) return []

  const coresUnicas = new Set<string>()
  const resultados = await Promise.all(itens.map((item) => parseSku(item.skuBruto ?? '')))

  resultados.forEach((r) => {
    if (r.cor) coresUnicas.add(r.cor)
  })

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

  // Calcular todos os payloads de forma síncrona antes de tocar no DB
  const computed = itens.map((item, idx) => {
    const r = resultados[idx]!
    const corDescricao = r.cor ? (mapaDescricao.get(r.cor) ?? r.cor) : ''
    const produtoId = r.modelo ? (mapaProduto.get(r.modelo) ?? null) : null
    const modeloDbId = r.modelo ? (mapaModelo.get(r.modelo)?.id ?? null) : null
    const tamanhoValido = !!r.tamanho && /^\d+$/.test(r.tamanho)
    const tamanhoNumerico = tamanhoValido ? parseInt(r.tamanho!, 10) : null
    const statusFinal =
      r.status === StatusItem.RESOLVIDO && !tamanhoValido ? StatusItem.PENDENTE : r.status
    return { item, r, corDescricao, produtoId, modeloDbId, tamanhoValido, tamanhoNumerico, statusFinal }
  })

  // Bulk UPDATE via JSON scalar: 1 round-trip para N rows.
  //
  // Por que JSON e não UNNEST/VALUES:
  //   - VALUES CTE: PostgreSQL infere tipos das colunas como "text" (parâmetros pg = OID unknown)
  //     → "operator does not exist: text = uuid" no WHERE i.id = v.id
  //   - UNNEST com $executeRawUnsafe: arrays JS são serializados como JSON ["a","b"] pelo engine
  //     do Prisma, não como literais PostgreSQL {a,b} — o cast ::uuid[] falha na comparação
  //   - JSON scalar ($1::json): passa uma única string JSON comum; sem ambiguidade de tipo.
  //     json_array_elements extrai objetos; (elem->>'id')::uuid é cast explícito text→uuid. ✓
  const payload = JSON.stringify(
    computed.map(({ item, r, corDescricao, produtoId, modeloDbId, tamanhoValido, tamanhoNumerico, statusFinal }) => ({
      id:            item.id,
      modelo:        r.modelo       ?? null,
      cor:           r.cor          ?? null,
      cor_descricao: corDescricao   || null,
      tamanho:       tamanhoValido ? tamanhoNumerico : null,
      status:        statusFinal    as string,
      produto_id:    produtoId      ?? null,
      modelo_id:     modeloDbId     ?? null,
    }))
  )

  await prisma.$executeRaw`
    UPDATE "itens_pedido" AS i
    SET
      modelo        = (elem->>'modelo'),
      cor           = (elem->>'cor'),
      cor_descricao = (elem->>'cor_descricao'),
      tamanho       = (elem->>'tamanho')::integer,
      status        = (elem->>'status')::"StatusItem",
      produto_id    = (elem->>'produto_id')::uuid,
      modelo_id     = (elem->>'modelo_id')::uuid
    FROM json_array_elements(${payload}::json) AS elem
    WHERE i.id = (elem->>'id')::uuid
  `

  return computed
    .filter(({ statusFinal, r }) => statusFinal === StatusItem.RESOLVIDO && r.modelo && r.cor && r.tamanho)
    .map(({ r, corDescricao, item }) => ({
      modelo: r.modelo!,
      cor: r.cor!,
      corDescricao: corDescricao || r.cor!,
      tamanho: r.tamanho!,
      quantidade: item.quantidade,
      status: StatusItem.RESOLVIDO,
    }))
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
