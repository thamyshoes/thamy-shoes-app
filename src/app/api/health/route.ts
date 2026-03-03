import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: {
    status: 'ok' | 'degraded'
    timestamp: string
    database: boolean
    version: string
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: false,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch {
    checks.status = 'degraded'
  }

  return NextResponse.json(checks, {
    status: checks.status === 'ok' ? 200 : 503,
  })
}
