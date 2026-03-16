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
  const userSetoresRaw = request.headers.get('x-user-setores')
  const userSetores = userSetoresRaw ? (userSetoresRaw.split(',') as Setor[]) : []

  if (!userPerfil) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // PRODUCAO: verificar se a ficha pertence a um dos setores do usuário
  if (userPerfil === Perfil.PRODUCAO) {
    const ficha = await prisma.fichaProducao.findUnique({ where: { id } })
    if (!ficha) {
      return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
    }
    if (userSetores.length > 0 && !userSetores.includes(ficha.setor)) {
      return NextResponse.json({ error: 'Sem permissão para esta ficha' }, { status: 403 })
    }
  }

  try {
    const { buffer, filename } = await pdfGeneratorService.downloadFicha(id)

    // ?inline=1 → exibir no browser (Visualizar); padrão → download (Baixar)
    const inline = request.nextUrl.searchParams.get('inline') === '1'
    const disposition = inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`

    // buffer.buffer pode ser maior que o Buffer real (pool compartilhado do Node.js).
    // Usar slice para garantir que só os bytes relevantes sejam enviados.
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.byteLength),
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
