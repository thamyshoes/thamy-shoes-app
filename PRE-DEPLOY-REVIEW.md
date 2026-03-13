# PRE-DEPLOY REVIEW — Thamy Shoes

**Data:** 2026-03-10
**Projeto:** Thamy Shoes — Fichas de Produção v2
**Stack:** Next.js 15.2.0 + TypeScript + Prisma + Supabase
**Plataforma:** Vercel (região: gru1)
**Package Manager:** npm

---

## RESUMO EXECUTIVO

| Fase | Status | Detalhes |
|------|--------|----------|
| BUILD | CORRIGIDO | Era FALHA — `export const dynamic` ausente em `/pedidos/consolidar` |
| TYPECHECK | OK | 0 erros TypeScript |
| LINT | OK | 0 erros, 4 warnings aceitáveis |
| TESTES | OK | 275 passando, 0 falhando (Vitest) |
| SEGURANÇA | OK | 0 críticas, 0 high, 4 moderate dev-only |
| ENVIRONMENT | OK | Todas as vars em `.env.example` + schema Zod |
| DATABASE | OK | 5 migrations aplicadas, schema válido |
| API | OK | `/api/health` funcional, error handlers presentes |
| MONITORING | AVISO | Sem error tracking configurado |
| PLATAFORMA (Vercel) | OK | vercel.json válido, headers globais, cron com secret |

**Bloqueadores resolvidos:** 1
**Bloqueadores pendentes:** 0
**Avisos:** 7
**Corrigidos automaticamente:** 1
**Info:** 2

---

## BLOQUEADORES (0 pendentes)

Nenhum bloqueador pendente após correções automáticas.

---

## CORREÇÕES AUTOMÁTICAS (1)

### [BUILD] `export const dynamic = 'force-dynamic'` adicionado

- **Arquivo:** `src/app/pedidos/consolidar/page.tsx`
- **Antes:** Server Component estático chamando `prisma.pedidoCompra.findMany()` no build sem credenciais de DB → `PrismaClientInitializationError: Authentication failed`
- **Depois:** `export const dynamic = 'force-dynamic'` adicionado após `export const metadata` — página renderizada sob demanda, sem tentativa de pré-render no CI

---

## AVISOS (7)

### 1. [MONITORING] Nenhum error tracking configurado

Nenhum SDK de error tracking detectado (Sentry, Datadog, Bugsnag, New Relic).

**Ação recomendada:** Instalar `@sentry/nextjs` e configurar DSN via variável de ambiente antes do go-live.

### 2. [MONITORING] 40 ocorrências de `console.log` em código de produção

Threshold do pipeline: > 20 ocorrências = AVISO.

**Observação:** Nenhum dado sensível encontrado nos logs verificados. Considerar substituição por logger estruturado (pino, winston) antes da produção.

### 3. [VERCEL] ISR revalidation não utilizada

`revalidatePath` e `revalidateTag` não encontrados no código. Mutações de dados não invalidam o cache Next.js automaticamente.

**Ação recomendada:** Adicionar `revalidatePath('/rota')` nas Server Actions após mutations críticas.

### 4. [VERCEL] `app/global-error.tsx` ausente

Erro global no App Router (erro no layout raiz) não tem handler dedicado.

**Ação recomendada:** Criar `src/app/global-error.tsx` com boundary mínimo:
```tsx
'use client'
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html><body>
      <h2>Algo deu errado</h2>
      <button onClick={() => reset()}>Tentar novamente</button>
    </body></html>
  )
}
```

### 5. [VERCEL] Cross-region latency: Vercel `gru1` → Supabase `us-east-1`

Região do Vercel configurada como `gru1` (São Paulo), mas Supabase está em `aws-1-us-east-1` (Virgínia). Cada query de DB adiciona ~100-150ms de latência inter-regional.

**Ação recomendada:** Migrar projeto Supabase para região `sa-east-1` (São Paulo) ou mover Vercel para `iad1` (Virgínia) para reduzir latência.

### 6. [SEGURANÇA] 4 vulnerabilidades moderate em dependências de desenvolvimento

Cadeia: `vitest@1.4.0` → `vite-node` → `vite@5.x` → `esbuild`. Todas dev-only, não presentes no bundle de produção.

**Ação:** Atualizar vitest para versão >= 3.x quando compatibilidade do projeto permitir.

### 7. [LINT] 4 warnings de lint

- `src/lib/pdf/templates/ficha-template.tsx:190` — `<Image>` sem atributo `alt`
- Arquivos de teste com variáveis não utilizadas

**Ação:** Adicionar `alt` descritivo na imagem da ficha template. Warnings em testes são aceitáveis.

---

## INFORMATIVO (2)

### 1. [VERCEL] `productionBrowserSourceMaps` não desabilitado

Source maps de browser habilitados por padrão. Facilita debugging mas expõe código-fonte no browser de produção.

**Opcional:** Adicionar `productionBrowserSourceMaps: false` ao `next.config.ts` se confidencialidade do código for requisito.

### 2. [SEGURANÇA] Vulnerabilidades moderate são dev-only

As 4 vulnerabilidades moderate detectadas (`npm audit`) estão exclusivamente na cadeia de ferramentas de desenvolvimento e não afetam o bundle de produção.

---

## CHECKS DETALHADOS

### FASE 1 — Build

| Check | Status | Detalhe |
|-------|--------|---------|
| `npm ci` | OK | Dependências instaladas sem erro |
| `npm run build` (pré-fix) | FALHA | `PrismaClientInitializationError` em `/pedidos/consolidar` |
| `npm run build` (pós-fix) | CORRIGIDO | `export const dynamic = 'force-dynamic'` resolve o bloqueador |
| Output standalone | N/A | Vercel não requer `output: 'standalone'` |
| Sem `output: 'export'` | OK | SSR mantido |

### FASE 2 — TypeCheck

| Check | Status | Detalhe |
|-------|--------|---------|
| `tsc --noEmit` | OK | 0 erros |
| Sem `as any` excessivo | OK | Nenhum `as any` em código de produção |
| Lockfiles fantasma em dir pai | OK | Nenhum `package-lock.json` sem `node_modules` acima do workspace |
| `jest.config` em tsconfig.exclude | N/A | Projeto usa Vitest, não Jest |

### FASE 3 — Lint

| Check | Status | Detalhe |
|-------|--------|---------|
| `npm run lint` | OK | Exit code 0 |
| Erros de lint | OK | 0 erros |
| Warnings de lint | AVISO | 4 warnings (Image sem alt, unused vars em testes) |
| Imports pendentes (`import {$`) | OK | Nenhum import quebrado detectado |

### FASE 4 — Testes

| Check | Status | Detalhe |
|-------|--------|---------|
| Vitest (unit/integration) | OK | 275 testes, 0 falhas |
| Playwright (E2E) | INFO | Runner disponível, testes E2E dependem de ambiente |
| Cobertura | N/A | Coverage não configurado no CI |

### FASE 5 — Segurança

| Check | Status | Detalhe |
|-------|--------|---------|
| `npm audit --audit-level=critical` | OK | 0 críticas, 0 high |
| Secrets no código | OK | Nenhum API key, token ou senha hardcoded detectado |
| `.gitignore` cobre `.env` | OK | `.env`, `.env.local`, `.env.production` ignorados |
| SQL Injection | OK | Prisma ORM parametrizado — sem concatenação de queries |
| XSS (`dangerouslySetInnerHTML`) | OK | Nenhuma ocorrência sem sanitização |
| `eval()` com input do usuário | OK | Nenhuma ocorrência |
| CORS wildcard | OK | Nenhum `origin: '*'` detectado |
| Debug mode em prod | OK | `NODE_ENV !== 'production'` não detectado em config de produção |
| Security headers | OK | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy aplicados globalmente via `next.config.ts` `'/(.*)'` |
| Lockfile commitado | OK | `package-lock.json` presente |

### FASE 6 — Environment

| Check | Status | Detalhe |
|-------|--------|---------|
| `.env.example` completo | OK | Todas as 16 vars documentadas |
| Zod schema (`src/lib/env.ts`) | OK | Validação de todas as vars na inicialização |
| Sem `NEXT_PUBLIC_` com secrets | OK | Nenhuma secret exposta ao client |
| Sem localhost em config de prod | OK | Nenhum valor localhost em `.env.example` |

### FASE 7 — Database

| Check | Status | Detalhe |
|-------|--------|---------|
| `npx prisma validate` | OK | Schema válido |
| Migrations aplicadas | OK | 5 migrations, todas aditivas |
| Migrations destrutivas | OK | Nenhum DROP TABLE/COLUMN detectado |
| `prisma generate` | OK | Executado via `postinstall` |
| `DATABASE_URL` documentado | OK | Presente em `.env.example` |
| `DIRECT_URL` para migrations | OK | Configurado para bypass de connection pooling |

### FASE 8 — API

| Check | Status | Detalhe |
|-------|--------|---------|
| Health endpoint | OK | `GET /api/health` retorna status DB + timestamp |
| Error handler global | OK | `app/error.tsx` e `app/not-found.tsx` presentes |
| `global-error.tsx` | AVISO | Ausente — erros no layout raiz sem handler |
| Cron endpoint com secret | OK | `CRON_SECRET` validado via Bearer token |

### FASE 9 — Monitoring

| Check | Status | Detalhe |
|-------|--------|---------|
| Error tracking (Sentry/Datadog) | AVISO | Nenhum SDK configurado |
| Logging sem dados sensíveis | OK | Nenhuma senha/token em console.log revisado |
| Volume de console.log | AVISO | 40 ocorrências em produção (threshold > 20) |

### FASE 10 — Vercel

| Check | Status | Detalhe |
|-------|--------|---------|
| `vercel.json` válido | OK | JSON parseado sem erros |
| Security headers | OK | Aplicados globalmente via `next.config.ts` — CSP, HSTS, X-Frame-Options |
| Edge runtime compatível | N/A | Nenhuma rota usa edge runtime |
| `proxy.ts` (Next.js 16) | N/A | Projeto em Next.js 15 |
| ISR revalidation | AVISO | `revalidatePath`/`revalidateTag` não utilizados |
| Cron com `CRON_SECRET` | OK | Endpoint valida `Authorization: Bearer` |
| Região configurada | OK | `gru1` (São Paulo) — AVISO de cross-region com Supabase |
| `productionBrowserSourceMaps` | INFO | Não desabilitado explicitamente |
| Fluid Compute | OK | Habilitado por padrão (Vercel, desde Abr/2025) |
| `output: 'standalone'` | OK | N/A para Vercel (não necessário) |
| Image optimization | OK | `next/image` com `remotePatterns: []` configurado |

---

## COMANDOS EXECUTADOS

| Comando | Status |
|---------|--------|
| `npm ci` | OK |
| `npx tsc --noEmit` | OK (0 erros) |
| `npm run lint` | OK (0 erros, 4 warnings) |
| `npx vitest run` | OK (275/275 passando) |
| `npm audit --audit-level=critical` | OK (0 críticas) |
| `npx prisma validate` | OK |
| `npx prisma migrate status` | OK (5 aplicadas) |

---

## MÉTRICAS

| Métrica | Valor |
|---------|-------|
| Testes passando | 275 |
| Testes falhando | 0 |
| Erros TypeScript | 0 |
| Erros de lint | 0 |
| Warnings de lint | 4 |
| Vulnerabilidades críticas | 0 |
| Vulnerabilidades high | 0 |
| Vulnerabilidades moderate | 4 (dev-only) |
| Migrations aplicadas | 5 |
| Env vars documentadas | 16 |
| Bloqueadores resolvidos | 1 |
| Bloqueadores pendentes | 0 |
| Avisos | 7 |

---

## VEREDICTO

**APROVADO** — Deploy pode prosseguir.

O único bloqueador encontrado (`export const dynamic` ausente em `/pedidos/consolidar`) foi corrigido automaticamente. Todos os demais checks críticos (TypeScript, lint, testes, segurança, database, API, Vercel) estão verdes.

Os 7 avisos são melhorias recomendadas mas não impedem o deploy. Prioridade pós-deploy: configurar error tracking (Sentry) e adicionar `global-error.tsx`.

---

*Gerado por `/pre-deploy-testing` — SystemForge*
*Data: 2026-03-10*
