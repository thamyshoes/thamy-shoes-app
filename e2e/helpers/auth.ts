import { type Page } from '@playwright/test'

type Perfil = 'ADMIN' | 'PCP' | 'PRODUCAO'

const CREDENTIALS: Record<Perfil, { email: string; password: string }> = {
  ADMIN: { email: 'admin@thamyshoes.com.br', password: 'admin123' },
  PCP: { email: 'pcp@thamyshoes.com.br', password: 'pcp123' },
  PRODUCAO: { email: 'producao@thamyshoes.com.br', password: 'producao123' },
}

const REDIRECT_AFTER_LOGIN: Record<Perfil, string> = {
  ADMIN: '/pedidos',
  PCP: '/pedidos',
  PRODUCAO: '/fichas',
}

/**
 * Realiza login como o perfil informado e aguarda o redirect pós-login.
 * Retorna a Page autenticada.
 */
export async function loginAs(page: Page, perfil: Perfil): Promise<Page> {
  const { email, password } = CREDENTIALS[perfil]
  const expectedRedirect = REDIRECT_AFTER_LOGIN[perfil]

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`**${expectedRedirect}`, { timeout: 10_000 })

  return page
}

/**
 * Realiza logout via botão na sidebar e aguarda redirect para /login.
 */
export async function logout(page: Page): Promise<void> {
  // Tenta clicar no botão de logout da sidebar
  const logoutBtn = page.getByRole('button', { name: /sair|logout/i })
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click()
  } else {
    // Fallback: chama endpoint diretamente
    await page.request.post('/api/auth/logout')
    await page.goto('/login')
  }
  await page.waitForURL('**/login', { timeout: 10_000 })
}

/**
 * Verifica se o cookie de autenticação está presente.
 */
export async function hasAuthCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies()
  return cookies.some((c) => c.name === 'auth-token')
}

/**
 * Remove manualmente o cookie de autenticação para simular sessão expirada.
 */
export async function clearAuthCookie(page: Page): Promise<void> {
  await page.context().clearCookies()
}

/**
 * Simula timeout de inatividade de 30 minutos manipulando o cookie last-activity.
 */
export async function simulateInactivityTimeout(page: Page): Promise<void> {
  const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000
  await page.context().addCookies([
    {
      name: 'last-activity',
      value: String(thirtyOneMinutesAgo),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ])
}
