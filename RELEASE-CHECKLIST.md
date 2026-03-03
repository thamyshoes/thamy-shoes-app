# Release Readiness Checklist — Thamy Shoes

**Data de geração:** 2026-03-02
**Versão:** 1.0.0 (Release Candidate)

---

## Build e Deploy

- [ ] `npm run build` sem erros (TypeScript + Next.js)
- [ ] `npm run lint` sem warnings de lint
- [ ] `npx tsc --noEmit` sem erros de tipo
- [ ] `npm test` (Vitest) — todos os testes unitários passando
- [ ] `npm run test:e2e` (Playwright) — 23+ testes E2E passando
- [ ] Vercel preview deploy funcional (preview URL testada)
- [ ] Todas as env vars configuradas no painel Vercel

### Comandos de verificação

```bash
npm run build && npm run lint && npx tsc --noEmit
npm test
npm run seed:test && npm run test:e2e
bash scripts/smoke-test.sh https://thamy-shoes.vercel.app
```

---

## Database

- [ ] `npx prisma migrate deploy` executado em staging (sem erros)
- [ ] Seed de admin inicial criado (`prisma db seed`)
- [ ] Seed de dados de teste removido antes de produção
- [ ] Backup automático ativo (Supabase — plano Pro recomendado)
- [ ] `DIRECT_URL` configurado para migrations (sem connection pooler)
- [ ] Índices do banco criados (conferir via `prisma studio`)

---

## Segurança

- [ ] `JWT_SECRET` com ≥ 32 caracteres aleatórios (`openssl rand -base64 48`)
- [ ] `ENCRYPTION_KEY` com 64 chars hex (32 bytes AES-256-GCM) (`openssl rand -hex 32`)
- [ ] `CRON_SECRET` configurado (`openssl rand -base64 24`)
- [ ] Rate limiting ativo: 5 tentativas / 15min por IP no `/api/auth/login`
- [ ] Brute force protection funcional (testar com 6 logins errados)
- [ ] Security headers no `vercel.json`: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- [ ] Nenhum secret hardcoded no código (`git grep -r "SECRET\|PASSWORD\|API_KEY"` — apenas refs)
- [ ] `.env` no `.gitignore` ✓
- [ ] Tokens Bling encriptados com AES-256-GCM ✓

---

## Funcionalidade

- [ ] Login funcional: ADMIN, PCP, PRODUCAO
- [ ] PRODUCAO redireciona para `/fichas` após login
- [ ] ADMIN redireciona para `/pedidos` após login
- [ ] OAuth Bling funcional: BLING_REDIRECT_URI configurado com domínio real
- [ ] Importação de pedidos: lista pedidos do Bling e importa
- [ ] SKU parsing: regra SKU ativa e parseando corretamente
- [ ] Geração de fichas PDF: 3 fichas por pedido (Cabedal, Palmilha, Sola)
- [ ] Consolidação multi-pedido: seleciona 2+, gera fichas consolidadas
- [ ] Download de PDFs: Content-Type: application/pdf
- [ ] Filtro por setor para PRODUCAO: automático via perfil
- [ ] CRUD de configurações: SKU, Cores, Grades, Equivalências, Campos Extras
- [ ] Notificações Vercel Cron: `0 8 * * *` executando `GET /api/cron/check-bling-token`
- [ ] Deduplicação de notificações: máximo 1 email/tipo/dia
- [ ] Timeout de sessão: inatividade de 30min redireciona para `/login`
- [ ] Logout: remove cookie `auth-token`

---

## Performance

- [ ] Lighthouse Performance ≥ 80 (rodar em staging com Lighthouse CI)
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Tempo de resposta listagem de pedidos p95 < 500ms
- [ ] Geração de PDF < 3s por pedido (com dados reais)
- [ ] Prisma: queries com índices (verificar via `EXPLAIN ANALYZE`)
- [ ] Circuit breaker Bling configurado (5 falhas → open por 60s)

---

## Monitoramento

- [ ] Vercel Analytics ativo (habilitar no painel)
- [ ] Error logging: `console.error` em todos os catch blocks críticos ✓
- [ ] Health check endpoint: `GET /api/health` retorna `{ status: "ok", database: true }` ✓
- [ ] Alertas de token Bling: RESEND_API_KEY + NOTIFICATION_EMAIL_TO configurados
- [ ] Vercel Cron schedule visível no painel Vercel (Deployments > Functions > Cron)

---

## Smoke Tests Finais (Pós-Deploy)

Execute após cada deploy:

```bash
bash scripts/smoke-test.sh https://seu-dominio.vercel.app
# Esperado: 10/10 testes passando
```

| # | Teste | Esperado |
|---|-------|----------|
| 1 | GET /api/health | `{ status: "ok", database: true }` |
| 2 | GET /login | HTTP 200 |
| 3 | POST /api/auth/login (admin) | HTTP 200 + cookie |
| 4 | GET /api/pedidos (sem cookie) | HTTP 401 |
| 5 | GET /api/pedidos (com cookie) | HTTP 200 |
| 6 | npm run build | Exit code 0 |
| 7 | npx prisma migrate deploy | Migrations OK |
| 8 | POST /api/cron/check-bling-token (sem secret) | HTTP 401 |
| 9 | GET /_next/static/ | Servidor responde |
| 10 | GET /rota-inexistente | HTTP 404 |

---

## Checklist de Go/No-Go

Todos os itens acima devem estar marcados antes do go-live. Em caso de No-Go, documentar o motivo e a data prevista de resolução.

**Status:** ⬜ Pendente / 🔄 Em revisão / ✅ Aprovado

**Aprovador:** _______________
**Data de aprovação:** _______________
