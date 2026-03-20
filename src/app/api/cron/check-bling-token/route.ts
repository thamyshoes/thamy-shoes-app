import { NextRequest, NextResponse } from 'next/server'
import { blingService } from '@/lib/bling/bling-service'
import { NotificationService } from '@/lib/notifications/notification-service'

async function handleCronRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Refresh proativo — renova o token mesmo sem uso do sistema
    let refreshOk = false
    try {
      await blingService.getValidToken()
      refreshOk = true
    } catch {
      // Refresh falhou — notificação será enviada abaixo
    }

    // 2. Verificar e notificar sobre expiração do refresh_token
    const service = new NotificationService()
    const resultado = await service.verificarTokenBling()

    return NextResponse.json({
      success: true,
      refreshOk,
      alertaEnviado: resultado.alertaEnviado,
      diasRestantes: resultado.diasRestantes,
      verificadoEm: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[cron/check-bling-token] Erro na verificação:', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Vercel Cron Jobs enviam GET por padrão
export async function GET(request: NextRequest) {
  return handleCronRequest(request)
}

// POST mantido como alias para chamadas manuais/testes
export async function POST(request: NextRequest) {
  return handleCronRequest(request)
}
