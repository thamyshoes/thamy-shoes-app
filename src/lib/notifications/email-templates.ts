import { ROUTES } from '@/lib/constants'

export interface EmailTemplate {
  subject: string
  html: string
}

export function getTokenExpiringTemplate(diasRestantes: number, baseUrl: string): EmailTemplate {
  const url = `${baseUrl}${ROUTES.CONFIG_BLING}`
  return {
    subject: `Bling: Token expira em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Alerta de Token Bling</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:1px solid #E2E8F0;overflow:hidden;">
        <tr>
          <td style="background:#475569;padding:20px 32px;">
            <span style="color:#FFFFFF;font-size:18px;font-weight:bold;">Thamy Shoes</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#0F172A;">
              ⚠️ Token Bling expira em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}
            </h1>
            <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
              O token de integração com o Bling está prestes a expirar. Renove-o antes que as importações parem.
            </p>
            <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
              <strong>Dias restantes:</strong> ${diasRestantes}
            </p>
            <a href="${url}" style="display:inline-block;background:#475569;color:#FFFFFF;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Renovar Token Bling
            </a>
            <hr style="margin:32px 0;border:none;border-top:1px solid #E2E8F0;">
            <p style="margin:0;font-size:12px;color:#94A3B8;">
              Você recebeu este email porque é administrador do sistema Thamy Shoes.<br>
              Acesse diretamente: <a href="${url}" style="color:#475569;">${url}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

export function getTokenExpiredTemplate(baseUrl: string): EmailTemplate {
  const url = `${baseUrl}${ROUTES.CONFIG_BLING}`
  return {
    subject: 'URGENTE: Token Bling expirou',
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Token Bling Expirado</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:2px solid #EF4444;overflow:hidden;">
        <tr>
          <td style="background:#EF4444;padding:20px 32px;">
            <span style="color:#FFFFFF;font-size:18px;font-weight:bold;">Thamy Shoes — URGENTE</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#DC2626;">
              🚨 Token Bling expirou
            </h1>
            <p style="margin:0 0 16px;color:#0F172A;line-height:1.6;">
              O token de integração com o Bling <strong>expirou</strong>. As importações de pedidos estão paradas.
            </p>
            <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
              <strong>Impacto:</strong> Nenhum novo pedido será importado até que o token seja renovado.
            </p>
            <a href="${url}" style="display:inline-block;background:#EF4444;color:#FFFFFF;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Reconectar Bling Agora
            </a>
            <hr style="margin:32px 0;border:none;border-top:1px solid #FEE2E2;">
            <p style="margin:0;font-size:12px;color:#94A3B8;">
              Você recebeu este email porque é administrador do sistema Thamy Shoes.<br>
              Acesse diretamente: <a href="${url}" style="color:#EF4444;">${url}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}
