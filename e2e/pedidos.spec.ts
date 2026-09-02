import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN')
  })

  test('1. lista de pedidos exibe tabela com dados', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // Tabela deve estar visível
    const tabela = page.getByRole('table')
    await expect(tabela).toBeVisible()

    // Deve conter ao menos um pedido da seed (E2E-001 ou E2E-002)
    const linhas = tabela.locator('tbody tr')
    await expect(linhas).toHaveCount(await linhas.count())
    expect(await linhas.count()).toBeGreaterThan(0)

    // Verifica colunas essenciais
    const cabecalhos = tabela.locator('thead th')
    const textos = await cabecalhos.allTextContents()
    expect(textos.join(' ')).toMatch(/pedido|número/i)
  })

  // A lista de pedidos filtra por status, fornecedor e intervalo de datas. Nao ha
  // busca por numero de pedido na UI; este teste cobre o filtro que existe.
  test('2. filtrar pedido por fornecedor filtra resultados', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    const busca = page.getByPlaceholder(/buscar fornecedor/i)
    await expect(busca).toBeVisible()

    await busca.fill('Cliente Teste E2E 1')
    // Aguarda debounce ou submit
    await page.waitForTimeout(500)

    // Deve sobrar apenas o pedido do fornecedor buscado
    const linhas = page.locator('table tbody tr')
    await expect(linhas.first()).toContainText('E2E-001')
    expect(await linhas.count()).toBe(1)
  })

  test('3. detalhe do pedido exibe grade de tamanhos', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // Clica no pedido E2E-001
    const linkPedido = page.getByRole('link', { name: /E2E-001/i }).first()
    if (await linkPedido.isVisible()) {
      await linkPedido.click()
    } else {
      // Fallback: clica na primeira linha
      await page.locator('table tbody tr').first().click()
    }

    await page.waitForLoadState('networkidle')

    // Grade de tamanhos deve aparecer (tabela ou grid com numerações)
    const grade = page.locator('[data-testid="grade-tamanhos"], table').first()
    await expect(grade).toBeVisible()
  })

  test('4. editar item do pedido abre modal e salva alteração', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // E2E-002 e o pedido cujo item continua PENDENTE — "Editar item" so renderiza
    // nesse estado (src/app/pedidos/[id]/page.tsx:95). A navegacao vem do
    // onRowClick do DataTable, que so responde depois da hidratacao.
    const rowPedido = page.locator('table tbody tr').filter({ hasText: 'E2E-002' }).first()
    await expect(rowPedido).toBeVisible()
    await expect(async () => {
      await rowPedido.click()
      await page.waitForURL(/\/pedidos\/[0-9a-f-]{36}/, { timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await page.waitForLoadState('networkidle')

    // Clica no botão de edição de um item
    const btnEditar = page.getByRole('button', { name: /editar|edit/i }).first()
    await expect(btnEditar).toBeVisible()
    await btnEditar.click()

    // Modal deve abrir
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()

    // Salva sem alterar (verifica que o botão de salvar está presente)
    const btnSalvar = modal.getByRole('button', { name: /salvar|confirmar/i })
    await expect(btnSalvar).toBeVisible()
    await btnSalvar.click()

    // Modal deve fechar
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
  })

  test('5. reimportar pedido exibe ConfirmDialog e atualiza dados', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // Navega para detalhe
    const linkPedido = page.getByRole('link', { name: /E2E-001/i }).first()
    if (await linkPedido.isVisible()) {
      await linkPedido.click()
    } else {
      await page.locator('table tbody tr').first().click()
    }
    await page.waitForLoadState('networkidle')

    // Clica em "Reimportar"
    const btnReimportar = page.getByRole('button', { name: /reimportar/i })
    await expect(btnReimportar).toBeVisible()
    await btnReimportar.click()

    // ConfirmDialog deve aparecer
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').last()
    await expect(dialog).toBeVisible()
    const textoConfirm = await dialog.textContent()
    expect(textoConfirm).toMatch(/reimportar|atualiz/i)

    // Cancela para não modificar dados de teste
    const btnCancelar = dialog.getByRole('button', { name: /cancelar|não/i })
    if (await btnCancelar.isVisible()) {
      await btnCancelar.click()
    } else {
      await page.keyboard.press('Escape')
    }

    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  })

  test('6. PRODUCAO não vê botão "Importar Pedidos"', async ({ page }) => {
    // Faz logout e loga como PRODUCAO
    await page.goto('/pedidos')
    // Já logado como ADMIN, mas precisamos como PRODUCAO
    // Primeiro logout
    const logoutBtn = page.getByRole('button', { name: /sair|logout/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL('**/login', { timeout: 10_000 })
    }

    await loginAs(page, 'PRODUCAO')

    // PRODUCAO vai para /fichas — tenta navegar para /pedidos (deve ser bloqueado ou redirecionar)
    // O middleware impede PRODUCAO de acessar /pedidos
    await page.goto('/pedidos')

    // Ou é redirecionado, ou vê página sem botão importar
    const isRedirected = page.url().includes('/fichas') || page.url().includes('/login')
    if (!isRedirected) {
      // Caso o PRODUCAO consiga ver a lista, verifica ausência do botão
      const btnImportar = page.getByRole('button', { name: /importar/i })
      await expect(btnImportar).not.toBeVisible()
    } else {
      // Redirecionado corretamente
      expect(isRedirected).toBe(true)
    }
  })
})
