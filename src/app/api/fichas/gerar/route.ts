import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { gerarFichasSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[fichas/gerar] Body recebido:', JSON.stringify(body))

    const parsed = gerarFichasSchema.safeParse(body)
    if (!parsed.success) {
      console.log('[fichas/gerar] Validação falhou:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { pedidoId } = parsed.data
    console.log('[fichas/gerar] Gerando fichas para pedidoId:', pedidoId)

    const fichas = await pdfGeneratorService.gerarFichas(pedidoId)
    console.log('[fichas/gerar] Fichas geradas com sucesso:', fichas.length)

    return NextResponse.json({ data: { fichas } }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar fichas'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[fichas/gerar] ERRO:', message)
    console.error('[fichas/gerar] Stack:', stack)
    const status =
      message.includes('não encontrado') || message.includes('não possui itens')
        ? 404
        : message.includes('pendentes') || message.includes('já foram geradas')
          ? 422
          : 500
    return NextResponse.json({ error: message, debug: { stack } }, { status })
  }
}
