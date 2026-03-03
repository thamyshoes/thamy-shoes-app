import { test, expect } from '@playwright/test'
import { loginAs, logout, hasAuthCookie, clearAuthCookie, simulateInactivityTimeout } from './helpers/auth'

test.describe('Autenticação', () => {
  test('1. login com credenciais válidas redireciona para /pedidos', async ({ page }) => {
    await loginAs(page, 'ADMIN')

    expect(page.url()).toContain('/pedidos')
    expect(await hasAuthCookie(page)).toBe(true)
  })

  test('2. login com credenciais inválidas exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', 'admin@thamyshoes.com.br')
    await page.fill('input[name="password"]', 'senha-errada')
    await page.click('button[type="submit"]')

    // Aguarda mensagem de erro aparecer (toast ou inline)
    const erroMsg = page.locator('text=/credencial|inválid|incorret|Erro/i').first()
    await expect(erroMsg).toBeVisible({ timeout: 5_000 })

    // Permanece em /login
    expect(page.url()).toContain('/login')
    expect(await hasAuthCookie(page)).toBe(false)
  })

  test('3. brute force bloqueia após 5 tentativas', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Faz 5 tentativas com senha errada
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', 'pcp@thamyshoes.com.br')
      await page.fill('input[name="password"]', 'senha-errada')
      await page.click('button[type="submit"]')
      // Pequena espera entre tentativas
      await page.waitForTimeout(300)
    }

    // 6ª tentativa deve mostrar mensagem de bloqueio
    await page.fill('input[name="email"]', 'pcp@thamyshoes.com.br')
    await page.fill('input[name="password"]', 'pcp123')
    await page.click('button[type="submit"]')

    const bloqueioMsg = page.locator('text=/bloqueada|bloqueio|15 minuto|429|muitas tentativas/i').first()
    await expect(bloqueioMsg).toBeVisible({ timeout: 5_000 })
  })

  test('4. acesso a /pedidos sem login redireciona para /login', async ({ page }) => {
    // Garante sem cookie de auth
    await clearAuthCookie(page)

    await page.goto('/pedidos')
    await page.waitForURL('**/login', { timeout: 10_000 })

    expect(page.url()).toContain('/login')
  })

  test('5. logout remove cookie e redireciona para /login', async ({ page }) => {
    await loginAs(page, 'ADMIN')
    expect(await hasAuthCookie(page)).toBe(true)

    await logout(page)

    expect(page.url()).toContain('/login')
    expect(await hasAuthCookie(page)).toBe(false)
  })

  test('6. timeout de inatividade (30min) redireciona para /login', async ({ page }) => {
    await loginAs(page, 'ADMIN')

    // Simula 31 minutos de inatividade manipulando o cookie last-activity
    await simulateInactivityTimeout(page)

    // Tenta navegar para área protegida
    await page.goto('/pedidos')

    await page.waitForURL('**/login', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})
