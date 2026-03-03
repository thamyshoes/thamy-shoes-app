import { NextRequest, NextResponse } from 'next/server'
import { pdfGeneratorService } from '@/lib/pdf/pdf-generator'
import { prisma } from '@/lib/prisma'
import { Perfil, Setor } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // RBAC: PRODUCAO can only download fichas for their own sector
  const userPerfil = request.headers.get('x-user-perfil') as Perfil | null
  const userSetor = request.headers.get('x-user-setor') as Setor | null

  if (!userPerfil) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // PRODUCAO: check sector match
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

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao baixar ficha'
    const status = message.includes('não encontrada') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
