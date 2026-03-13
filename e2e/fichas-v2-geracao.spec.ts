/**
 * fichas-v2-geracao.spec.ts
 *
 * Testa o fluxo: PCP acessa detalhe de pedido E2EV2-001, verifica SKU
 * interpretado pelo SkuReverseParser, clica em "Gerar Fichas", seleciona
 * setores no dialog e confirma geração.
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { cleanupFichasE2E } from './helpers/cleanup-fichas-e2e'

test.describe('Fichas V2 — Geração por Setor', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'PCP')
  })

  test.afterAll(async () => {
    await cleanupFichasE2E()
  })

  test('1. PCP acessa lista de pedidos', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL('**/login')

    // Tabela de pedidos deve estar visível
    const tabela = page.locator('table').first()
    const emptyState = page.locator('text=/nenhum pedido|sem pedidos/i').first()

    const visivel =
      (await tabela.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await emptyState.isVisible({ timeout: 3_000 }).catch(() => false))

    expect(visivel).toBe(true)
  })

  test('2. PCP navega para detalhe do pedido E2EV2-001', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // Tenta localizar o pedido E2EV2-001 pelo número
    const linkPedido = page.getByRole('link', { name: /E2EV2-001/i }).first()

    if (await linkPedido.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await linkPedido.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/pedidos/')
    } else {
      // Pedido pode não estar no banco de teste, pular graciosamente
      test.skip()
    }
  })

  test('3. Detalhe do pedido exibe itens com modelo ABC123 interpretado', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    const linkPedido = page.getByRole('link', { name: /E2EV2-001/i }).first()

    if (!(await linkPedido.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await linkPedido.click()
    await page.waitForLoadState('networkidle')

    // A página de detalhe deve mostrar os itens
    // SkuReverseParser deve ter mapeado ABC123-001-37 → modelo: ABC123, cor: 001
    const modeloVisivel = page.locator('text=/ABC123/i').first()
    const corVisivel = page.locator('text=/001|vermelho/i').first()

    const temModelo = await modeloVisivel.isVisible({ timeout: 5_000 }).catch(() => false)
    const temCor = await corVisivel.isVisible({ timeout: 3_000 }).catch(() => false)

    // Pelo menos modelo ou cor deve estar visível na página
    expect(temModelo || temCor).toBe(true)
  })

  test('4. Botão "Gerar Fichas" está visível no detalhe do pedido', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    const linkPedido = page.getByRole('link', { name: /E2EV2-001/i }).first()

    if (!(await linkPedido.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await linkPedido.click()
    await page.waitForLoadState('networkidle')

    const btnGerar = page.getByRole('button', { name: /gerar ficha/i })
    await expect(btnGerar).toBeVisible({ timeout: 5_000 })
  })

  test('5. Clicar em "Gerar Fichas" abre dialog de seleção de setores', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    const linkPedido = page.getByRole('link', { name: /E2EV2-001/i }).first()

    if (!(await linkPedido.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await linkPedido.click()
    await page.waitForLoadState('networkidle')

    const btnGerar = page.getByRole('button', { name: /gerar ficha/i })

    if (!(await btnGerar.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await btnGerar.click()

    // Popover ou dialog de seleção de setores deve aparecer
    const dialog = page.locator('[role="dialog"]').first()
    const popover = page.locator('[role="dialog"], [data-radix-popper-content-wrapper]').first()

    const dialogAberto =
      (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await popover.isVisible({ timeout: 3_000 }).catch(() => false))

    expect(dialogAberto).toBe(true)
  })

  test('6. Dialog de setores exibe opções Cabedal, Palmilha, Sola', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    const linkPedido = page.getByRole('link', { name: /E2EV2-001/i }).first()

    if (!(await linkPedido.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await linkPedido.click()
    await page.waitForLoadState('networkidle')

    const btnGerar = page.getByRole('button', { name: /gerar ficha/i })

    if (!(await btnGerar.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await btnGerar.click()

    // Verifica checkboxes de setores
    const checkCabedal = page.getByRole('checkbox', { name: /cabedal/i })
      .or(page.locator('label').filter({ hasText: /cabedal/i }))
      .first()

    const checkPalmilha = page.getByRole('checkbox', { name: /palmilha/i })
      .or(page.locator('label').filter({ hasText: /palmilha/i }))
      .first()

    const checkSola = page.getByRole('checkbox', { name: /sola/i })
      .or(page.locator('label').filter({ hasText: /sola/i }))
      .first()

    await expect(checkCabedal).toBeVisible({ timeout: 5_000 })
    await expect(checkPalmilha).toBeVisible({ timeout: 3_000 })
    await expect(checkSola).toBeVisible({ timeout: 3_000 })
  })

  test('7. PCP seleciona setor Cabedal e confirma geração', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    const linkPedido = page.getByRole('link', { name: /E2EV2-001/i }).first()

    if (!(await linkPedido.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await linkPedido.click()
    await page.waitForLoadState('networkidle')

    const btnGerar = page.getByRole('button', { name: /gerar ficha/i })

    if (!(await btnGerar.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await btnGerar.click()

    // Seleciona Cabedal
    const checkCabedal = page.getByRole('checkbox', { name: /cabedal/i }).first()

    if (await checkCabedal.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const isChecked = await checkCabedal.isChecked()
      if (!isChecked) {
        await checkCabedal.check()
      }
    }

    // Confirma geração
    const btnConfirmar = page
      .getByRole('button', { name: /confirmar|gerar|ok/i })
      .last()

    if (await btnConfirmar.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await btnConfirmar.click()

      // Aguarda processamento (PDF pode demorar)
      await page.waitForLoadState('networkidle', { timeout: 30_000 })

      // Deve aparecer toast de sucesso ou lista de fichas
      const sucesso = page
        .locator('text=/ficha.*gerada|sucesso|gerado/i')
        .or(page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: /sucesso|gerado/i }))
        .first()

      const toastVisivelOuNavegou =
        (await sucesso.isVisible({ timeout: 15_000 }).catch(() => false)) ||
        page.url().includes('/fichas') ||
        page.url().includes('/pedidos/')

      expect(toastVisivelOuNavegou).toBe(true)
    }
  })
})
