import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { prisma } from '@/lib/prisma'
import { Perfil, Setor } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const userPerfil = request.headers.get('x-user-perfil') as Perfil | null
  const userSetor = request.headers.get('x-user-setor') as Setor | null

  if (!userPerfil) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // PRODUCAO: verificar se a ficha pertence ao setor do usuario
  if (userPerfil === Perfil.PRODUCAO) {
    const ficha = await prisma.fichaProducao.findUnique({ where: { id } })
    if (!ficha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }
    if (userSetor && ficha.setor !== userSetor) {
      return NextResponse.json({ error: 'Sem permissão para esta ficha' }, { status: 403 })
    }
  }

  try {
    const { buffer, filename } = await pdfGeneratorService.downloadFicha(id)

    // ?inline=1 → exibir no browser (Visualizar); padrão → download (Baixar)
    const inline = request.nextUrl.searchParams.get('inline') === '1'
    const disposition = inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao baixar ficha'
    console.error('[fichas/download] ERRO:', message, err instanceof Error ? err.stack : '')
    const status = message.includes('não encontrada') ? 404 : 500
    const clientMessage = status === 500 ? 'Algo deu errado. Tente novamente.' : message
    return NextResponse.json({ error: clientMessage }, { status })
  }
}
