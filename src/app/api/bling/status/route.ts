import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { StatusConexao } from '@/types'
import { blingService } from '@/lib/bling/bling-service'

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
      refreshTokenExpiresAt: null,
      configOk,
    })
  }

  // Se refresh_token expirou (30 dias), reconexão manual é obrigatória
  if (
    connection.refreshTokenExpiresAt &&
    connection.refreshTokenExpiresAt < new Date()
  ) {
    if (connection.status !== StatusConexao.EXPIRADO) {
      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: { status: StatusConexao.EXPIRADO },
      })
    }
    return NextResponse.json({
      status: StatusConexao.EXPIRADO,
      expiresAt: connection.expiresAt,
      connectedAt: connection.connectedAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
      configOk,
    })
  }

  // Se access_token expirou mas refresh_token ainda é válido, tentar refresh
  if (
    connection.status !== StatusConexao.DESCONECTADO &&
    connection.expiresAt < new Date()
  ) {
    try {
      await blingService.getValidToken()
      // Refresh bem-sucedido — recarregar conexão atualizada
      const updated = await prisma.blingConnection.findFirst()
      return NextResponse.json({
        status: updated?.status ?? StatusConexao.CONECTADO,
        expiresAt: updated?.expiresAt ?? connection.expiresAt,
        connectedAt: updated?.connectedAt ?? connection.connectedAt,
        refreshTokenExpiresAt: updated?.refreshTokenExpiresAt ?? connection.refreshTokenExpiresAt,
        configOk,
      })
    } catch {
      // Refresh falhou — marcar como expirado
      return NextResponse.json({
        status: StatusConexao.EXPIRADO,
        expiresAt: connection.expiresAt,
        connectedAt: connection.connectedAt,
        refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
        configOk,
      })
    }
  }

  return NextResponse.json({
    status: connection.status,
    expiresAt: connection.expiresAt,
    connectedAt: connection.connectedAt,
    refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    configOk,
  })
}
