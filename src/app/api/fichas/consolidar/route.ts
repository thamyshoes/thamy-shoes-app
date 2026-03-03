import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { montarGradesConsolidadas } from '@/lib/bling/sku-parser'
import { consolidarSchema } from '@/lib/validators'

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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/fichas/consolidar — gera fichas consolidadas
export async function POST(request: NextRequest) {
  try {
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
    const status =
      message.includes('não foram encontrados') ? 404
      : message.includes('pendentes') ? 422
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
