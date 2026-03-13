import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { montarGradesConsolidadas } from '@/lib/bling/sku-parser'
import { consolidarSchema } from '@/lib/validators'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'

// GET /api/fichas/consolidar?pedidoIds[]=x&pedidoIds[]=y
// Preview of grades for selected pedidos (no generation)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const pedidoIds = searchParams.getAll('pedidoIds[]')

  if (pedidoIds.length < 2) {
    return NextResponse.json(
      { error: 'Selecione pelo menos 2 pedidos para visualizar a grade consolidada' },
      { status: 400 },
    )
  }

  const agruparPorFaixa = searchParams.get('agruparPorFaixa') === 'true'

  try {
    const grades = await montarGradesConsolidadas(pedidoIds, { agruparPorFaixa })
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)
    return NextResponse.json({ data: { grades, totalPares } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao consolidar grades'
    console.error('[fichas/consolidar GET] ERRO:', message)
    return NextResponse.json({ error: 'Algo deu errado. Tente novamente.' }, { status: 500 })
  }
}

// POST /api/fichas/consolidar — gera fichas consolidadas
export async function POST(request: NextRequest) {
  try {
    // Rate limit por IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = rateLimit(`fichas-consolidar:${ip}`, RATE_LIMIT_CONFIGS.fichas)
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em instantes.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      )
    }

    const body = await request.json()
    const parsed = consolidarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { pedidoIds, agruparPorFaixa } = parsed.data
    const fichas = await pdfGeneratorService.gerarFichasConsolidadas(pedidoIds, { agruparPorFaixa })

    return NextResponse.json({ data: { fichas } }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar fichas consolidadas'
    console.error('[fichas/consolidar POST] ERRO:', message, err instanceof Error ? err.stack : '')
    const status =
      message.includes('não foram encontrados') ? 404
      : message.includes('pendentes') ? 422
      : 500
    const clientMessage = status === 500 ? 'Algo deu errado. Tente novamente.' : message
    return NextResponse.json({ error: clientMessage }, { status })
  }
}
