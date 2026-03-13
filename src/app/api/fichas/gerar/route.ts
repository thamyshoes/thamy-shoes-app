import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { gerarFichasSchema } from '@/lib/validators'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'
import { Setor } from '@/types'

// Aumentar timeout para geração de PDF (Vercel Pro: até 60s)
export const maxDuration = 60

// Setores padrão quando não informados (backward compatibility)
const SETORES_PADRAO: Setor[] = [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA]

export async function POST(request: NextRequest) {
  try {
    // Rate limit por IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = rateLimit(`fichas-gerar:${ip}`, RATE_LIMIT_CONFIGS.fichas)
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
    console.log('[fichas/gerar] Body recebido:', JSON.stringify(body))

    const parsed = gerarFichasSchema.safeParse(body)
    if (!parsed.success) {
      console.log('[fichas/gerar] Validação falhou:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 },
      )
    }

    const { pedidoId, setores } = parsed.data
    const setoresParaGerar = setores ? (setores as Setor[]) : SETORES_PADRAO
    console.log('[fichas/gerar] Gerando fichas para pedidoId:', pedidoId, 'setores:', setoresParaGerar)

    const { fichas, avisos } = await pdfGeneratorService.gerarFichas(pedidoId, setoresParaGerar)
    console.log('[fichas/gerar] Fichas geradas com sucesso:', fichas.length, 'avisos:', avisos.length)

    return NextResponse.json({ data: { fichas }, avisos }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar fichas'
    console.error('[fichas/gerar] ERRO:', message, err instanceof Error ? err.stack : '')
    const status =
      message.includes('não encontrado') || message.includes('não possui itens')
        ? 404
        : message.includes('pendentes') || message.includes('já foram geradas')
          ? 422
          : 500
    const clientMessage = status === 500 ? 'Algo deu errado. Tente novamente.' : message
    return NextResponse.json({ error: clientMessage }, { status })
  }
}
