import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { StatusConexao } from '@/types'

export async function POST(_req: NextRequest) {
  const connection = await prisma.blingConnection.findFirst()

  if (connection) {
    await prisma.blingConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: '',
        refreshToken: '',
        status: StatusConexao.DESCONECTADO,
      },
    })
  }

  return NextResponse.json({ success: true })
}
