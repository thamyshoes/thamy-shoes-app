import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP as requireAdmin } from '@/lib/api-guard'
import { parseSku } from '@/lib/bling/sku-parser'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ModeloAgrupado {
  codigo: string
  nome: string
  cores: Set<string>
}

interface ImportResult {
  modelosCriados: number
  modelosExistentes: number
  variantesCriadas: number
  linhasProcessadas: number
  linhasIgnoradas: number
  erros: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detecta se o conteúdo é CSV do Bling (tab-separated com header).
 */
/** Limite de tamanho do payload (10MB — suficiente para CSVs grandes) */
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024

function isBlingCsvFormat(firstLine: string): boolean {
  // Strip BOM UTF-8 se presente
  const clean = firstLine.replace(/^\uFEFF/, '')
  return clean.includes('\t') && /^(ID|id)\t/i.test(clean)
}

/**
 * Extrai cor legível da Descrição do Bling (ex: "Tamanho:18;Cor:Pink" → "Pink").
 */
function extrairCorDescricao(descricao: string): string | null {
  const match = descricao.match(/Cor[:\s]*([^;]+)/i)
  return match?.[1]?.trim() || null
}

// ── Route ────────────────────────────────────────────────────────────────────

// POST /api/configuracoes/modelos/bulk-import
//
// Aceita dois formatos:
// 1. CSV do Bling (tab-separated, com header) — usa colunas Código (B) e Descrição (C)
// 2. Formato manual: Código;Nome;Cabedal;Sola;Palmilha (backward compat)
//
// Body: { dados: string } (conteúdo do CSV como texto)
// O CSV NÃO é armazenado — processado em memória e descartado.
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const dados = (body as { dados?: string }).dados
  if (!dados || typeof dados !== 'string') {
    return NextResponse.json({ error: 'Campo "dados" obrigatório' }, { status: 400 })
  }

  // Protecao contra payload excessivo
  if (dados.length > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: `Payload excede limite de ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB` }, { status: 413 })
  }

  // Strip BOM UTF-8
  const dadosClean = dados.replace(/^\uFEFF/, '')
  const linhas = dadosClean.split('\n').map((l) => l.trim()).filter(Boolean)
  if (linhas.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha encontrada' }, { status: 400 })
  }

  if (isBlingCsvFormat(linhas[0]!)) {
    return processarBlingCsv(linhas)
  }

  return processarFormatoManual(linhas)
}

// ── Processamento CSV Bling ──────────────────────────────────────────────────

async function processarBlingCsv(linhas: string[]): Promise<NextResponse> {
  const result: ImportResult = {
    modelosCriados: 0,
    modelosExistentes: 0,
    variantesCriadas: 0,
    linhasProcessadas: 0,
    linhasIgnoradas: 0,
    erros: [],
  }

  // Agrupar por modelo para evitar duplicatas e reduzir queries
  const modelosMap = new Map<string, ModeloAgrupado>()
  // Coletar mapeamentos de cor para batch upsert
  const corMapeamentos = new Map<string, string>() // corCodigo → corNome

  // Pular header (linha 0)
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i]!.split('\t')
    const codigo = cols[1]?.trim()    // Coluna B — Código
    const descricao = cols[2]?.trim() // Coluna C — Descrição

    if (!codigo) {
      result.linhasIgnoradas++
      continue
    }

    try {
      const parsed = await parseSku(codigo)

      if (!parsed.modelo) {
        // SKU não resolveu (ex: código de anúncio MLB...) — ignorar
        result.linhasIgnoradas++
        continue
      }

      result.linhasProcessadas++

      if (!modelosMap.has(parsed.modelo)) {
        // Tentar extrair nome do produto a partir de linhas não-variação
        const isVariationDesc = descricao && /tamanho:|cor:/i.test(descricao)
        const nome = (descricao && !isVariationDesc)
          ? descricao
          : `Modelo ${parsed.modelo}`

        modelosMap.set(parsed.modelo, {
          codigo: parsed.modelo,
          nome,
          cores: new Set<string>(),
        })
      }

      // Registrar cor se extraída do SKU
      if (parsed.cor) {
        modelosMap.get(parsed.modelo)!.cores.add(parsed.cor)

        // Coletar mapeamento de cor para batch (não faz query aqui)
        if (descricao && !corMapeamentos.has(parsed.cor)) {
          const corNome = extrairCorDescricao(descricao)
          if (corNome) corMapeamentos.set(parsed.cor, corNome)
        }
      }
    } catch (err) {
      result.erros.push(`Linha ${i + 1} (${codigo}): ${err instanceof Error ? err.message : 'erro'}`)
    }
  }

  // Batch upsert de MapeamentoCor (em lotes de 20 para não sobrecarregar)
  const corEntries = [...corMapeamentos.entries()]
  const BATCH = 20
  for (let i = 0; i < corEntries.length; i += BATCH) {
    const batch = corEntries.slice(i, i + BATCH)
    await Promise.all(
      batch.map(([codigo, descricao]) =>
        prisma.mapeamentoCor.upsert({
          where: { codigo },
          update: {},
          create: { codigo, descricao },
        }).catch(() => { /* ignora duplicata */ })
      )
    )
  }

  // Criar/verificar Modelos e suas variantes (upsert para race-safety)
  for (const [, grupo] of modelosMap) {
    try {
      const existing = await prisma.modelo.findUnique({
        where: { codigo: grupo.codigo },
        select: { id: true },
      })

      let modeloId: string

      if (existing) {
        modeloId = existing.id
        result.modelosExistentes++
      } else {
        // upsert para evitar race condition em importações simultâneas
        const created = await prisma.modelo.upsert({
          where: { codigo: grupo.codigo },
          update: {},
          create: { codigo: grupo.codigo, nome: grupo.nome },
          select: { id: true },
        })
        modeloId = created.id
        result.modelosCriados++
      }

      // Criar variantes de cor em batch (upsert para race-safety)
      const coresArray = [...grupo.cores]
      for (let i = 0; i < coresArray.length; i += BATCH) {
        const batch = coresArray.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map(async (corCodigo) => {
            const antes = await prisma.modeloVarianteCor.findUnique({
              where: { modeloId_corCodigo: { modeloId, corCodigo } },
              select: { id: true },
            })
            await prisma.modeloVarianteCor.upsert({
              where: { modeloId_corCodigo: { modeloId, corCodigo } },
              update: {},
              create: { modeloId, corCodigo },
            })
            return !antes // true se não existia antes
          })
        )
        result.variantesCriadas += results.filter(Boolean).length
      }
    } catch (err) {
      result.erros.push(`Modelo ${grupo.codigo}: ${err instanceof Error ? err.message : 'erro'}`)
    }
  }

  return NextResponse.json(result)
}

// ── Formato manual (backward compat) ─────────────────────────────────────────

interface LinhaParseada {
  codigo: string
  nome: string
  cabedal: string | null
  sola: string | null
  palmilha: string | null
  observacoes: string | null
}

function parseLinha(linha: string, idx: number): { data: LinhaParseada } | { erro: string } {
  const sep = linha.includes(';') ? ';' : ','
  const partes = linha.split(sep).map((p) => p.trim())

  const codigo = partes[0]
  const nome = partes[1]

  if (!codigo || !nome) {
    return { erro: `Linha ${idx + 1}: código e nome são obrigatórios` }
  }

  return {
    data: {
      codigo,
      nome,
      cabedal: partes[2] || null,
      sola: partes[3] || null,
      palmilha: partes[4] || null,
      observacoes: partes[5] || null,
    },
  }
}

async function processarFormatoManual(linhas: string[]): Promise<NextResponse> {
  const erros: string[] = []
  const validas: LinhaParseada[] = []

  for (let i = 0; i < linhas.length; i++) {
    const result = parseLinha(linhas[i]!, i)
    if ('erro' in result) {
      erros.push(result.erro)
    } else {
      validas.push(result.data)
    }
  }

  if (validas.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha válida', erros }, { status: 422 })
  }

  let criados = 0
  let atualizados = 0

  for (const linha of validas) {
    const existing = await prisma.modelo.findUnique({
      where: { codigo: linha.codigo },
      select: { id: true },
    })

    await prisma.modelo.upsert({
      where: { codigo: linha.codigo },
      update: {
        nome: linha.nome,
        cabedal: linha.cabedal,
        sola: linha.sola,
        palmilha: linha.palmilha,
        observacoes: linha.observacoes,
      },
      create: linha,
    })

    if (existing) {
      atualizados++
    } else {
      criados++
    }
  }

  return NextResponse.json({
    modelosCriados: criados,
    modelosExistentes: atualizados,
    variantesCriadas: 0,
    linhasProcessadas: validas.length,
    linhasIgnoradas: erros.length,
    erros,
  })
}
