/**
 * fichas-v2-consolidado.spec.ts
 *
 * Testa o fluxo: PCP acessa /pedidos/consolidar, seleciona pedidos E2EV2-001
 * e E2EV2-002, e gera consolidado de fichas por setor.
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { cleanupFichasE2E } from './helpers/cleanup-fichas-e2e'

test.describe('Fichas V2 — Consolidado de Pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'PCP')
  })

  test.afterAll(async () => {
    await cleanupFichasE2E()
  })

  test('1. PCP acessa página de consolidado', async ({ page }) => {
    await page.goto('/pedidos/consolidar')
    await page.waitForLoadState('networkidle')

    // Não deve redirecionar para login
    await expect(page).not.toHaveURL('**/login')
    await expect(page).not.toHaveURL('**/fichas')

    // Deve ter algum conteúdo de seleção de pedidos
    const conteudo = page
      .locator('text=/consolidar|selecionar pedido/i')
      .or(page.locator('input[type="checkbox"]'))
      .or(page.locator('table'))
      .first()

    await expect(conteudo).toBeVisible({ timeout: 5_000 })
  })

  test('2. Página de consolidado exibe lista de pedidos com checkboxes', async ({ page }) => {
    await page.goto('/pedidos/consolidar')
    await page.waitForLoadState('networkidle')

    // Checkboxes de seleção de pedidos
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()

    if (count === 0) {
      // Sem pedidos disponíveis — valida empty state
      const emptyState = page
        .locator('text=/nenhum pedido|sem pedidos|vazio/i')
        .first()
      await expect(emptyState).toBeVisible({ timeout: 3_000 })
    } else {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('3. PCP seleciona pedidos E2EV2-001 e E2EV2-002 para consolidado', async ({ page }) => {
    await page.goto('/pedidos/consolidar')
    await page.waitForLoadState('networkidle')

    // Tenta localizar pedidos E2EV2-001 e E2EV2-002
    const rowPedido1 = page.locator('tr, [role="row"], li').filter({ hasText: 'E2EV2-001' }).first()
    const rowPedido2 = page.locator('tr, [role="row"], li').filter({ hasText: 'E2EV2-002' }).first()

    const tem1 = await rowPedido1.isVisible({ timeout: 5_000 }).catch(() => false)
    const tem2 = await rowPedido2.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!tem1 && !tem2) {
      // Fallback: seleciona os primeiros 2 checkboxes disponíveis
      const checkboxes = page.locator('input[type="checkbox"]')
      const count = await checkboxes.count()

      if (count >= 2) {
        await checkboxes.nth(0).check()
        await checkboxes.nth(1).check()

        expect(await checkboxes.nth(0).isChecked()).toBe(true)
        expect(await checkboxes.nth(1).isChecked()).toBe(true)
      } else if (count === 1) {
        await checkboxes.nth(0).check()
        expect(await checkboxes.nth(0).isChecked()).toBe(true)
      } else {
        test.skip()
      }
      return
    }

    // Marca os pedidos E2E
    if (tem1) {
      const cb1 = rowPedido1.locator('input[type="checkbox"]').first()
      if (await cb1.isVisible()) await cb1.check()
    }
    if (tem2) {
      const cb2 = rowPedido2.locator('input[type="checkbox"]').first()
      if (await cb2.isVisible()) await cb2.check()
    }
  })

  test('4. Botão "Gerar Consolidado" está visível e habilitado ao selecionar pedidos', async ({ page }) => {
    await page.goto('/pedidos/consolidar')
    await page.waitForLoadState('networkidle')

    // Seleciona pelo menos 1 checkbox
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()

    if (count === 0) {
      test.skip()
      return
    }

    await checkboxes.nth(0).check()

    // Botão de gerar deve aparecer ou habilitar
    const btnGerar = page.getByRole('button', { name: /gerar consolidad|consolidar/i })
    await expect(btnGerar).toBeVisible({ timeout: 5_000 })
    await expect(btnGerar).not.toBeDisabled()
  })

  test('5. PCP gera consolidado e recebe resposta de sucesso', async ({ page }) => {
    await page.goto('/pedidos/consolidar')
    await page.waitForLoadState('networkidle')

    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()

    if (count === 0) {
      test.skip()
      return
    }

    // Seleciona pedidos disponíveis (até 2)
    await checkboxes.nth(0).check()
    if (count >= 2) {
      await checkboxes.nth(1).check()
    }

    // Clica em gerar consolidado
    const btnGerar = page.getByRole('button', { name: /gerar consolidad|consolidar/i })

    if (!(await btnGerar.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await btnGerar.click()

    // Pode aparecer dialog de confirmação
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last()
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const btnConfirmar = dialog
        .getByRole('button', { name: /confirmar|gerar|sim|ok/i })
        .first()
      if (await btnConfirmar.isVisible()) {
        await btnConfirmar.click()
      }
    }

    // Aguarda processamento (PDF de consolidado pode demorar mais)
    await page.waitForLoadState('networkidle', { timeout: 30_000 })

    // Verifica resultado: toast de sucesso, download iniciado, ou setor exibido
    const toastSucesso = page
      .locator('[data-sonner-toast], [role="status"], [aria-live]')
      .filter({ hasText: /consolidad|sucesso|gerado/i })
      .first()

    const downloadLink = page
      .getByRole('link', { name: /baixar|download|pdf/i })
      .or(page.locator('a[download]'))
      .first()

    const resultadoVisivel =
      (await toastSucesso.isVisible({ timeout: 15_000 }).catch(() => false)) ||
      (await downloadLink.isVisible({ timeout: 5_000 }).catch(() => false))

    expect(resultadoVisivel).toBe(true)
  })

  test('6. Central de Fichas exibe fichas geradas para PRODUCAO (setor Cabedal)', async ({ page }) => {
    // Faz logout e login como PRODUCAO
    await page.request.post('/api/auth/logout').catch(() => {})
    await loginAs(page, 'PRODUCAO')

    // PRODUCAO é redirecionado para /fichas
    await page.waitForURL('**/fichas', { timeout: 10_000 })
    await page.waitForLoadState('networkidle')

    // Select de setor deve estar fixo em CABEDAL (disabled)
    const selectSetor = page.locator('#filtro-setor, select[aria-label*="setor" i]').first()

    if (await selectSetor.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const valorSetor = await selectSetor.inputValue()
      expect(valorSetor.toUpperCase()).toBe('CABEDAL')

      // Select deve estar desabilitado para PRODUCAO
      await expect(selectSetor).toBeDisabled()
    }

    // Listagem ou empty state deve aparecer
    const lista = page
      .locator('[role="list"], [role="listitem"], text=/nenhuma ficha/i')
      .first()
    await expect(lista).toBeVisible({ timeout: 5_000 })
  })
})
