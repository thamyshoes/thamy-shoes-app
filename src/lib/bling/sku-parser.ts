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

// ── ST002: interpretarItens ───────────────────────────────────────────────────

export async function interpretarItens(itens: ItemPedido[]): Promise<ItemInterpretado[]> {
  if (itens.length === 0) return []

  const coresUnicas = new Set<string>()
  const resultados = await Promise.all(itens.map((item) => parseSku(item.skuBruto ?? '')))

  resultados.forEach((r) => {
    if (r.cor) coresUnicas.add(r.cor)
  })

  // Buscar mapeamentos de cor e produtos por código de uma vez
  const modelosUnicos = [...new Set(resultados.map((r) => r.modelo).filter(Boolean) as string[])]

  const [mapeamentos, produtos] = await Promise.all([
    prisma.mapeamentoCor.findMany({ where: { codigo: { in: [...coresUnicas] } } }),
    modelosUnicos.length > 0
      ? prisma.produto.findMany({ where: { codigo: { in: modelosUnicos } }, select: { id: true, codigo: true } })
      : Promise.resolve([]),
  ])

  const mapaDescricao = new Map(mapeamentos.map((m) => [m.codigo, m.descricao]))
  const mapaProduto = new Map(produtos.map((p) => [p.codigo, p.id]))

  const interpretados: ItemInterpretado[] = []

  await Promise.all(
    itens.map(async (item, idx) => {
      const r = resultados[idx]!
      const corDescricao = r.cor ? (mapaDescricao.get(r.cor) ?? r.cor) : ''
      const produtoId = r.modelo ? (mapaProduto.get(r.modelo) ?? null) : null

      await prisma.itemPedido.update({
        where: { id: item.id },
        data: {
          modelo: r.modelo,
          cor: r.cor,
          corDescricao: corDescricao || null,
          tamanho: r.tamanho ? parseInt(r.tamanho, 10) || null : null,
          status: r.status,
          produtoId,
        },
      })

      if (r.status === StatusItem.RESOLVIDO && r.modelo && r.cor && r.tamanho) {
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
    temFacheta?: boolean
    materialBasePalmilha?: string | null
    variantesCor?: { corCodigo: string; cabedalOverride: string | null; corSola: string | null; corFacheta: string | null; corForroPalmilha: string | null; codigoFichaPalmilha: string | null; descricaoPalmilha: string | null }[]
  }[] = []

  if (modeloCodes.length > 0) {
    try {
      console.log('[montarGradesConsolidadas] Buscando modelos com campos novos...')
      modelosCadastrados = await prisma.modelo.findMany({
        where: { codigo: { in: modeloCodes } },
        select: {
          codigo: true,
          nome: true,
          cabedal: true,
          sola: true,
          palmilha: true,
          temFacheta: true,
          materialBasePalmilha: true,
          variantesCor: true,
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
      modeloNome: modeloInfo?.nome,
      // Cabedal: se há override por cor, usa o override; senão usa o padrão
      modeloCabedal: variante?.cabedalOverride ?? modeloInfo?.cabedal ?? undefined,
      modeloSola: modeloInfo?.sola ?? undefined,
      modeloPalmilha: modeloInfo?.palmilha ?? undefined,
      // Dados de variante por cor
      modeloTemFacheta: modeloInfo?.temFacheta ?? false,
      corFacheta: variante?.corFacheta ?? undefined,
      corSola: variante?.corSola ?? undefined,
      corForroPalmilha: variante?.corForroPalmilha ?? undefined,
      codigoFichaPalmilha: variante?.codigoFichaPalmilha ?? undefined,
      descricaoPalmilha: variante?.descricaoPalmilha ?? undefined,
      cor: grupo.cor,
      corDescricao: grupo.corDescricao,
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
