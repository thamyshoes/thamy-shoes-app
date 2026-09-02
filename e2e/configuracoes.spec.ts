import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN')
  })

  test('1. hub de configurações exibe cards com links', async ({ page }) => {
    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')

    // Deve estar na página sem redirect
    expect(page.url()).toContain('/configuracoes')

    // Verifica links para sub-páginas de configuração
    const linksEsperados = [
      /bling/i,
      /sku/i,
      /cor/i,
      /grade|numera/i,
      /campo/i,
    ]

    for (const pattern of linksEsperados) {
      const link = page
        .getByRole('link', { name: pattern })
        .or(page.locator(`a:has-text("${pattern.source}")`))
        .first()

      // Pelo menos 4 dos 6 links devem estar visíveis (Bling pode ter estado especial)
      const visivel = await link.isVisible({ timeout: 2_000 }).catch(() => false)
      if (!visivel) {
        const texto = page.locator(`text=${pattern.source}`).first()
        expect(await texto.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(true)
      }
    }
  })

  test('2. CRUD regra SKU — criar, ativar e listar', async ({ page }) => {
    await page.goto('/configuracoes/sku')
    await page.waitForLoadState('networkidle')

    // Deve listar regras existentes (incluindo a da seed E2E)
    const listaOuEmpty = page
      .locator('table, [data-testid="regras-list"]')
      .or(page.getByText(/nenhuma regra/i))
      .first()
    await expect(listaOuEmpty).toBeVisible()

    // Cria nova regra
    const btnNova = page.getByRole('button', { name: /nova regra|adicionar|criar/i })
    await expect(btnNova).toBeVisible()
    await btnNova.click()

    // Formulário ou modal de criação
    const form = page.locator('form, [role="dialog"]').last()
    await expect(form).toBeVisible()

    const inputNome = form.getByLabel(/nome/i).or(form.locator('input[name="nome"]'))
    await inputNome.fill('Regra E2E Nova')

    const inputPadrao = form.getByLabel(/padrão|padrao|regex/i).or(form.locator('input[name="padrao"]'))
    if (await inputPadrao.isVisible()) {
      await inputPadrao.fill('^([A-Z]+)-(\\d+)$')
    }

    const btnSalvar = form.getByRole('button', { name: /salvar|criar|confirmar/i })
    await btnSalvar.click()

    // O toast de sucesso do sonner dura ~4s e desaparece antes do networkidle
    // terminar, entao a evidencia duravel de que a regra foi criada e a propria
    // linha na listagem.
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Regra E2E Nova').first()).toBeVisible({ timeout: 10_000 })
  })

  test('3. CRUD cor — criar mapeamento manual', async ({ page }) => {
    await page.goto('/configuracoes/cores')
    await page.waitForLoadState('networkidle')

    // Lista de mapeamentos (incluindo os da seed)
    const lista = page.locator('table, [data-testid="cores-list"]').first()
    await expect(lista).toBeVisible()

    // Verifica que cores da seed estão presentes
    await expect(page.locator('text=Preto').first()).toBeVisible()

    // Cria novo mapeamento
    const btnNovo = page.getByRole('button', { name: /nov[oa]|adicionar|criar/i })
    await expect(btnNovo).toBeVisible()
    await btnNovo.click()

    const form = page.locator('form, [role="dialog"]').last()
    await expect(form).toBeVisible()

    const inputCodigo = form.getByLabel(/código|codigo/i).or(form.locator('input[name="codigo"]'))
    await inputCodigo.fill('RX')

    // O formulario de cores tem Codigo, Descricao e Cor (hex) — nao existe campo
    // "Nome". Ver src/app/configuracoes/cores/page.tsx.
    const inputDescricao = form
      .getByLabel(/descri/i)
      .or(form.locator('input[name="descricao"]'))
      .first()
    await inputDescricao.fill('Roxo E2E')

    const btnSalvar = form.getByRole('button', { name: /salvar|criar|confirmar/i })
    await btnSalvar.click()

    // Evidencia duravel: a cor aparece na listagem (o toast e transiente).
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Roxo E2E').first()).toBeVisible({ timeout: 10_000 })
  })

  test('4. CRUD grade — criar grade de numeração', async ({ page }) => {
    await page.goto('/configuracoes/grades')
    await page.waitForLoadState('networkidle')

    const lista = page
      .locator('table, [data-testid="grades-list"]')
      .or(page.getByText(/nenhuma grade/i))
      .first()
    await expect(lista).toBeVisible()

    // Cria nova grade
    const btnNova = page.getByRole('button', { name: /nova|adicionar|criar/i })
    await expect(btnNova).toBeVisible()
    await btnNova.click()

    const form = page.locator('form, [role="dialog"]').last()
    await expect(form).toBeVisible()

    const inputNome = form.getByLabel(/nome/i).or(form.locator('input[name="nome"]'))
    await inputNome.fill('Grade Adulto E2E')

    // O formulario tem DOIS campos de tamanho (#grade-min "Tamanho Minimo" e
    // #grade-max "Tamanho Maximo"), entao /tamanho/i casaria os dois e violaria o
    // strict mode. Enderecamos cada um pelo id; os defaults ja sao validos, mas
    // fixamos a faixa para o teste nao depender deles.
    await form.locator('#grade-min').fill('36')
    await form.locator('#grade-max').fill('40')

    const btnSalvar = form.getByRole('button', { name: /salvar|criar|confirmar/i })
    await btnSalvar.click()

    // Evidencia duravel: a grade aparece na listagem (o toast e transiente).
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Grade Adulto E2E').first()).toBeVisible({ timeout: 10_000 })
  })

  test('5. PCP em /configuracoes — vê "Alterar Senha" + status read-only do Bling', async ({ page }) => {
    // Logout ADMIN e login como PCP
    const logoutBtn = page.getByRole('button', { name: /sair|logout/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL('**/login', { timeout: 10_000 })
    }

    await loginAs(page, 'PCP')

    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')

    // PCP permanece em /configuracoes (sem redirect)
    expect(page.url()).toContain('/configuracoes')

    // Card de senha visivel; card Bling visivel em modo leitura;
    // cards admin de configuracao ocultos.
    await expect(page.getByText(/alterar senha/i).first()).toBeVisible()
    await expect(page.getByTestId('bling-readonly-card')).toBeVisible()
    await expect(page.getByText(/gerenciada pelo administrador/i)).toBeVisible()
    await expect(page.getByText(/regras de sku/i)).toHaveCount(0)
    await expect(page.getByText(/campos extras por setor/i)).toHaveCount(0)

    // O card de Bling e read-only — nao existe link clicavel para /configuracoes/bling
    const blingCard = page.getByTestId('bling-readonly-card')
    await expect(blingCard.locator('a')).toHaveCount(0)

    // URLs admin diretas continuam bloqueadas
    await page.goto('/configuracoes/bling')
    await page.waitForLoadState('networkidle')
    expect(page.url()).not.toContain('/configuracoes/bling')
  })

  test('6. PRODUCAO não acessa /configuracoes — redireciona ou exibe 403', async ({ page }) => {
    // Logout e login como PRODUCAO
    const logoutBtn = page.getByRole('button', { name: /sair|logout/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL('**/login', { timeout: 10_000 })
    }

    await loginAs(page, 'PRODUCAO')

    // PRODUCAO tenta acessar configurações
    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')

    const isRedirected =
      !page.url().includes('/configuracoes') ||
      (await page.locator('text=/acesso negado|sem permissão|403|proibido/i').first().isVisible({ timeout: 3_000 }).catch(() => false))

    expect(isRedirected).toBe(true)
  })
})
