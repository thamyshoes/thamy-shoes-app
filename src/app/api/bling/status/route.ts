import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { StatusConexao } from '@/types'

export async function GET(_req: NextRequest) {
  const configOk = Boolean(
    env.BLING_CLIENT_ID && env.BLING_CLIENT_SECRET && env.BLING_REDIRECT_URI,
  )

  const connection = await prisma.blingConnection.findFirst()

  if (!connection) {
    return NextResponse.json({
      status: StatusConexao.DESCONECTADO,
      expiresAt: null,
      connectedAt: null,
      configOk,
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
      configOk,
    })
  }

  return NextResponse.json({
    status: connection.status,
    expiresAt: connection.expiresAt,
    connectedAt: connection.connectedAt,
    configOk,
  })
}
