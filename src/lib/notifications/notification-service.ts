import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { NOTIFICATION_TYPES } from '@/lib/constants'
import { StatusConexao } from '@/types'
import {
  type EmailTemplate,
  getTokenExpiringTemplate,
  getTokenExpiredTemplate,
  getPasswordResetTemplate,
} from './email-templates'

export class NotificationService {
  private resend: Resend
  private emailTo: string

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY)
    this.emailTo = env.NOTIFICATION_EMAIL_TO ?? env.ADMIN_EMAIL
  }

  async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: 'Thamy Shoes <noreply@thamyshoes.com.br>',
      to,
      subject: template.subject,
      html: template.html,
    })
    if (error) {
      console.error('[NotificationService] Falha no envio de email:', error)
      throw new Error(`Resend error: ${error.message}`)
    }
  }

  async jaNotificouHoje(tipo: string): Promise<boolean> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const count = await prisma.notificacaoLog.count({
      where: { tipo, enviadoEm: { gte: startOfDay } },
    })
    return count > 0
  }

  async registrarNotificacao(tipo: string, destinatario: string): Promise<void> {
    await prisma.notificacaoLog.create({
      data: { tipo, destinatario },
    })
  }

  async verificarTokenBling(): Promise<{ alertaEnviado: boolean; diasRestantes: number | null }> {
    // Buscar qualquer conexão (não apenas CONECTADO — o cron pode já ter feito refresh)
    const conn = await prisma.blingConnection.findFirst({
      where: { status: { not: StatusConexao.DESCONECTADO } },
    })

    if (!conn) return { alertaEnviado: false, diasRestantes: null }

    const agora = new Date()
    // Calcular dias restantes baseado no REFRESH TOKEN (30 dias), não no access token (6h)
    const referencia = conn.refreshTokenExpiresAt ?? conn.expiresAt
    const diff = referencia.getTime() - agora.getTime()
    const diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24))
    const baseUrl = env.NEXT_PUBLIC_APP_URL

    if (diasRestantes <= 0) {
      const jaEnviou = await this.jaNotificouHoje(NOTIFICATION_TYPES.TOKEN_EXPIRED)
      if (jaEnviou) return { alertaEnviado: false, diasRestantes }
      const template = getTokenExpiredTemplate(baseUrl)
      await this.sendEmail(this.emailTo, template)
      await this.registrarNotificacao(NOTIFICATION_TYPES.TOKEN_EXPIRED, this.emailTo)
      return { alertaEnviado: true, diasRestantes }
    }

    if (diasRestantes <= 7) {
      const jaEnviou = await this.jaNotificouHoje(NOTIFICATION_TYPES.TOKEN_EXPIRING_SOON)
      if (jaEnviou) return { alertaEnviado: false, diasRestantes }
      const template = getTokenExpiringTemplate(diasRestantes, baseUrl)
      await this.sendEmail(this.emailTo, template)
      await this.registrarNotificacao(NOTIFICATION_TYPES.TOKEN_EXPIRING_SOON, this.emailTo)
      return { alertaEnviado: true, diasRestantes }
    }

    return { alertaEnviado: false, diasRestantes }
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const baseUrl = env.NEXT_PUBLIC_APP_URL
    const template = getPasswordResetTemplate(baseUrl, token)
    await this.sendEmail(email, template)
  }
}
