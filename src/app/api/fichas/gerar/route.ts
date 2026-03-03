import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { gerarFichasSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = gerarFichasSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { pedidoId } = parsed.data
    const fichas = await pdfGeneratorService.gerarFichas(pedidoId)

    return NextResponse.json({ data: { fichas } }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar fichas'
    const status =
      message.includes('não encontrado') || message.includes('não possui itens')
        ? 404
        : message.includes('pendentes') || message.includes('já foram geradas')
          ? 422
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
