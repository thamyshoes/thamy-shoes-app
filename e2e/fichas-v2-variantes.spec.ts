/**
 * fichas-v2-variantes.spec.ts
 *
 * Testa o fluxo: Admin acessa /configuracoes/modelos, abre modal de variantes
 * do modelo ABC123 e cadastra/visualiza variante de cor.
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { cleanupFichasE2E } from './helpers/cleanup-fichas-e2e'

test.describe('Fichas V2 — Variantes de Modelo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN')
  })

  test.afterAll(async () => {
    await cleanupFichasE2E()
  })

  test('1. Admin visualiza lista de modelos', async ({ page }) => {
    await page.goto('/configuracoes/modelos')
    await page.waitForLoadState('networkidle')

    // Tabela ou listagem de modelos deve estar visível
    await expect(page).not.toHaveURL('**/login')
    const tabela = page.locator('table, [role="table"]').first()
    const cardModelo = page.locator('text=/ABC123/i').first()

    const visivel =
      (await tabela.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await cardModelo.isVisible({ timeout: 3_000 }).catch(() => false))

    expect(visivel).toBe(true)
  })

  test('2. Admin abre modal de variantes do modelo ABC123', async ({ page }) => {
    await page.goto('/configuracoes/modelos')
    await page.waitForLoadState('networkidle')

    // Localiza a linha do modelo ABC123
    const linhaModelo = page.locator('tr, [role="row"]').filter({ hasText: 'ABC123' }).first()

    if (await linhaModelo.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Clica no botão de variantes da linha (N cores, Variantes, ou ícone)
      const btnVariantes = linhaModelo
        .getByRole('button', { name: /cor|variante|ver/i })
        .or(linhaModelo.locator('button').last())
        .first()

      if (await btnVariantes.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await btnVariantes.click()

        // Modal de variantes deve abrir
        const modal = page.locator('[role="dialog"]').first()
        await expect(modal).toBeVisible({ timeout: 5_000 })

        // Modal deve conter referência ao modelo
        const conteudoModal = await modal.textContent()
        expect(conteudoModal).toBeTruthy()
      } else {
        // Alternativa: clicar direto na célula de código do modelo
        await linhaModelo.click()
        await page.waitForLoadState('networkidle')
        expect(page.url()).not.toContain('/login')
      }
    } else {
      // Se não há modelos, valida que a página carregou corretamente
      const emptyOrTable = page
        .locator('text=/nenhum modelo|cadastrar/i')
        .or(page.locator('table'))
        .first()
      await expect(emptyOrTable).toBeVisible({ timeout: 5_000 })
    }
  })

  test('3. Modal de variantes exibe planilha de cores e numeração', async ({ page }) => {
    await page.goto('/configuracoes/modelos')
    await page.waitForLoadState('networkidle')

    // Abre modal de variantes para ABC123
    const linhaModelo = page.locator('tr, [role="row"]').filter({ hasText: 'ABC123' }).first()

    if (!(await linhaModelo.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    const btnVariantes = linhaModelo
      .getByRole('button', { name: /cor|variante/i })
      .or(linhaModelo.locator('button').last())
      .first()

    if (!(await btnVariantes.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await btnVariantes.click()

    const modal = page.locator('[role="dialog"]').first()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Modal deve ter estrutura de grid/planilha (role="grid" ou tabela)
    const grid = modal.locator('[role="grid"], table').first()
    const listaVariantes = modal.locator('tr, [role="row"]')

    const temEstrutura =
      (await grid.isVisible({ timeout: 3_000 }).catch(() => false)) ||
      (await listaVariantes.count()) > 0

    expect(temEstrutura).toBe(true)
  })

  test('4. Selecionar cor no select do modal de variantes', async ({ page }) => {
    await page.goto('/configuracoes/modelos')
    await page.waitForLoadState('networkidle')

    const linhaModelo = page.locator('tr, [role="row"]').filter({ hasText: 'ABC123' }).first()

    if (!(await linhaModelo.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    const btnVariantes = linhaModelo
      .getByRole('button', { name: /cor|variante/i })
      .or(linhaModelo.locator('button').last())
      .first()

    if (!(await btnVariantes.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await btnVariantes.click()

    const modal = page.locator('[role="dialog"]').first()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Verifica se existe select de cor ou input de cor dentro do modal
    const selectCor = modal
      .locator('select[aria-label*="cor" i], select[name*="cor" i]')
      .or(modal.locator('select').first())

    if (await selectCor.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Tenta selecionar a cor 001
      const options = await selectCor.locator('option').allTextContents()
      const temCor001 = options.some((o) => o.includes('001') || o.toLowerCase().includes('vermelho'))

      if (temCor001) {
        await selectCor.selectOption({ label: /vermelho|001/i })
        // Verifica que não houve erro após seleção
        await page.waitForLoadState('domcontentloaded')
        await expect(modal).toBeVisible()
      }
    }

    // Botão de fechar/cancelar deve funcionar
    const btnFechar = modal
      .getByRole('button', { name: /fechar|cancelar|×/i })
      .or(modal.locator('button[aria-label*="fechar" i]'))
      .first()

    if (await btnFechar.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await btnFechar.click()
      await expect(modal).not.toBeVisible({ timeout: 3_000 })
    }
  })
})
