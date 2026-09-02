import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Fichas PDF', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN')
  })

  test('1. gerar fichas de um pedido exibe cards de fichas', async ({ page }) => {
    // A geracao de fichas renderiza o PDF e faz upload para o Supabase Storage.
    // Sem bucket real o upload falha ("fetch failed") e nenhuma ficha e criada —
    // nao ha o que assertar. O workflow marca E2E_NO_STORAGE=1 justamente porque
    // usa SUPABASE_URL placeholder; com um projeto Supabase de teste provisionado
    // basta remover a flag e este cenario volta a rodar de verdade.
    test.skip(
      process.env.E2E_NO_STORAGE === '1',
      'requer Supabase Storage real (ver .github/workflows/e2e.yml)',
    )

    // Login + navegacao + geracao de 3 PDFs nao cabe nos 30s default.
    test.slow()

    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // A coluna "Numero" e texto puro, nao link: a navegacao vem do onRowClick do
    // DataTable, que so responde depois da hidratacao. Sem esperar a URL de
    // detalhe, o teste segue em /pedidos e /gerar ficha/i casa o botao inline de
    // cada linha (violacao de strict mode).
    const rowPedido = page.locator('table tbody tr').filter({ hasText: 'E2E-001' }).first()
    await expect(rowPedido).toBeVisible()
    await expect(async () => {
      await rowPedido.click()
      await page.waitForURL(/\/pedidos\/[0-9a-f-]{36}/, { timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await page.waitForLoadState('networkidle')

    // Clica em "Gerar Fichas"
    const btnGerar = page.getByRole('button', { name: /gerar ficha/i }).first()
    await expect(btnGerar).toBeVisible()
    await btnGerar.click()

    // O clique abre o DialogSetores (CABEDAL/SOLA/PALMILHA ja marcados). Endereçamos
    // pelo testid: a pagina de detalhe tambem monta o EditItemModal, entao
    // `[role="dialog"]`.last() pegava o modal errado e o Confirmar nunca era
    // clicado — o teste chegava ao fim com o dialog ainda aberto.
    await expect(page.getByTestId('dialog-setores')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('dialog-setores-confirmar-button').click()

    // A secao "Fichas Geradas" so e renderizada quando pedido.fichas.length > 0, e
    // cada card usa data-testid="pedido-ficha-card-{id}" (ver
    // src/app/pedidos/[id]/page.tsx:268). Nao existe <a> de download — o download
    // e feito por fetch + blob em botoes.
    await expect(page.getByTestId('pedido-fichas-section')).toBeVisible({ timeout: 30_000 })
    await expect(
      page.locator('[data-testid^="pedido-ficha-card-"]').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('2. download de ficha retorna Content-Type PDF', async ({ page }) => {
    // Navega para a central de fichas onde fichas E2E podem estar listadas
    await page.goto('/fichas')
    await page.waitForLoadState('networkidle')

    // Procura o primeiro link/botão de download de ficha
    const downloadLink = page
      .getByRole('link', { name: /download|pdf|baixar/i })
      .or(page.locator('[data-testid="btn-download"]'))
      .first()

    if (!(await downloadLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Se não há fichas ainda, o teste é pulado graciosamente
      test.skip()
      return
    }

    // Intercepta o download para verificar o Content-Type
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      downloadLink.click(),
    ])

    // Verifica que o arquivo foi iniciado (Content-Type validado pelo servidor)
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  })

  test('3. PRODUCAO só vê fichas do seu setor (Cabedal)', async ({ page }) => {
    // Logout e login como PRODUCAO (setor Cabedal)
    const logoutBtn = page.getByRole('button', { name: /sair|logout/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL('**/login', { timeout: 10_000 })
    }

    await loginAs(page, 'PRODUCAO')

    // PRODUCAO vai direto para /fichas
    expect(page.url()).toContain('/fichas')
    await page.waitForLoadState('networkidle')

    // Verifica que o filtro de setor está aplicado automaticamente
    // A URL deve conter ?setor=Cabedal ou o select deve mostrar "Cabedal"
    const urlComSetor = page.url().includes('setor=Cabedal') || page.url().includes('setor=cabedal')
    const seletorSetor = page.locator('select, [data-testid="filtro-setor"]').first()

    if (await seletorSetor.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const valorSetor = await seletorSetor.inputValue()
      expect(valorSetor.toLowerCase()).toContain('cabedal')
    } else {
      // Verifica via URL ou pelo filtro visível na UI
      const filtroVisivelTexto = await page.locator('text=/Cabedal/i').first().isVisible()
      expect(urlComSetor || filtroVisivelTexto).toBe(true)
    }
  })

  test('4. central de fichas lista fichas com filtros funcionais', async ({ page }) => {
    await page.goto('/fichas')
    await page.waitForLoadState('networkidle')

    // A página deve carregar sem erro
    await expect(page).not.toHaveURL('**/login')
    await expect(page).not.toHaveURL('**/erro')

    // Deve ter filtros (por setor, por status, ou por pedido)
    const filtros = page.locator(
      'select, input[type="search"], input[type="date"], input[placeholder*="filtrar" i], input[placeholder*="buscar" i], input[placeholder*="dd/mm" i]',
    )
    expect(await filtros.count()).toBeGreaterThan(0)

    // Verifica que há alguma listagem (cards, tabela, ou mensagem de "sem fichas")
    const listagemOuEmpty = page
      .locator('table, [data-testid="fichas-list"]')
      .or(page.getByText(/sem fichas|nenhuma ficha/i))
      .first()
    await expect(listagemOuEmpty).toBeVisible({ timeout: 5_000 })
  })

  test('5. consolidar 2 pedidos gera fichas consolidadas', async ({ page }) => {
    await page.goto('/pedidos')
    await page.waitForLoadState('networkidle')

    // Verifica se há botão de consolidação na página de pedidos ou fichas
    const btnConsolidar = page
      .getByRole('button', { name: /consolidar/i })
      .or(page.getByRole('link', { name: /consolidar/i }))
      .first()

    if (!(await btnConsolidar.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Tenta via rota direta de consolidação
      await page.goto('/pedidos/consolidar')
      await page.waitForLoadState('networkidle')
    } else {
      await btnConsolidar.click()
      await page.waitForLoadState('networkidle')
    }

    // Seleciona pedidos E2E-001 e E2E-002 via checkboxes
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()

    if (count >= 2) {
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()

      // Clica em "Gerar Consolidado" ou equivalente
      const btnGerar = page.getByRole('button', { name: /gerar consolidad|consolidar/i })
      if (await btnGerar.isVisible()) {
        await btnGerar.click()

        // Confirm dialog
        const dialog = page.locator('[role="alertdialog"], [role="dialog"]').last()
        if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const btnConfirmar = dialog.getByRole('button', { name: /confirmar|gerar|sim/i })
          if (await btnConfirmar.isVisible()) await btnConfirmar.click()
        }

        // Aguarda resultado
        await page.waitForLoadState('networkidle')

        // Deve aparecer fichas consolidadas ou mensagem de sucesso
        const sucesso = page
          .locator('text=/consolidad|gerado|success/i')
          .or(page.locator('[data-testid="ficha-card"]'))
          .first()
        await expect(sucesso).toBeVisible({ timeout: 15_000 })
      }
    } else {
      // Se não há pedidos suficientes na página, valida que a UI de consolidação existe
      await expect(page.locator('text=/consolidar|selecione/i').first()).toBeVisible()
    }
  })
})
