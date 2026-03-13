import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { invalidarCacheRegra } from '@/lib/bling/sku-parser'

const digitosSegmentoSchema = z.object({
  campo: z.string(),
  digitos: z.number().int().positive(),
})

const createSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  modo: z.enum(['SEPARADOR', 'SUFIXO']).default('SEPARADOR'),
  separador: z.string().length(1).default('-'),
  ordem: z.array(z.enum(['modelo', 'cor', 'tamanho'])).length(3).default(['modelo', 'cor', 'tamanho']),
  segmentos: z.array(z.string()).default([]),
  digitosSufixo: z.array(digitosSegmentoSchema).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const regras = await prisma.regraSkU.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(regras)
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { digitosSufixo, ...rest } = parsed.data
  const regra = await prisma.regraSkU.create({
    data: {
      ...rest,
      digitosSufixo: digitosSufixo === null || digitosSufixo === undefined
        ? Prisma.JsonNull
        : digitosSufixo,
    },
  })
  invalidarCacheRegra()
  return NextResponse.json(regra, { status: 201 })
}
