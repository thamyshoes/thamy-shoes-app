import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { StatusConexao } from '@/types'

export async function GET(_req: NextRequest) {
  const connection = await prisma.blingConnection.findFirst()

  if (!connection) {
    return NextResponse.json({
      status: StatusConexao.DESCONECTADO,
      expiresAt: null,
      connectedAt: null,
    })
  }

  // Auto-mark as expired if token is past its expiry date
  if (
    connection.status === StatusConexao.CONECTADO &&
    connection.expiresAt < new Date()
  ) {
    await prisma.blingConnection.update({
      where: { id: connection.id },
      data: { status: StatusConexao.EXPIRADO },
    })
    return NextResponse.json({
      status: StatusConexao.EXPIRADO,
      expiresAt: connection.expiresAt,
      connectedAt: connection.connectedAt,
    })
  }

  return NextResponse.json({
    status: connection.status,
    expiresAt: connection.expiresAt,
    connectedAt: connection.connectedAt,
  })
}
