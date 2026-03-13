# Guia de Contribuição — Thamy Shoes

## Estratégia de Branches

- `main`: produção (protegida, requer PR aprovado + CI verde)
- `develop`: staging (deploy automático após merge via Vercel)
- `feature/{descricao}`: features em desenvolvimento (PR para develop)
- `hotfix/{descricao}`: correções urgentes (PR direto para main + cherry-pick para develop)

## Fluxo de Trabalho

1. Criar branch a partir de `develop`: `git checkout -b feature/minha-feature develop`
2. Implementar mudanças
3. Criar PR para `develop` usando o template fornecido
4. CI deve passar (lint, types, testes, build)
5. Aguardar aprovação de pelo menos 1 revisor
6. Merge para `develop` → deploy automático para staging (Vercel preview)
7. Após validação em staging: deploy para produção via GitHub Actions > Run workflow

## Banco de dados

Ao alterar o `prisma/schema.prisma`, criar a migration localmente antes do PR:

```bash
npx prisma migrate dev --name descricao-da-mudanca
```

A migration será aplicada automaticamente no pipeline de deploy via `prisma migrate deploy`.

## Variáveis de Ambiente

Nunca comitar valores reais de `.env`. Usar `.env.example` como referência.
Novas variáveis devem ser adicionadas ao `.env.example` e documentadas em `PENDING-ACTIONS.md`.

## Convencões de Commits

Usar Conventional Commits:
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` apenas documentação
- `refactor:` sem impacto funcional
- `test:` adição/correção de testes
- `chore:` tarefas de build, config, etc.

## Executar localmente

```bash
# Instalar dependências
npm ci

# Banco de dados (desenvolvimento)
npx prisma migrate dev
npx prisma db seed

# Servidor de desenvolvimento
npm run dev

# Testes
npm test            # unitários (Vitest)
npm run test:e2e    # E2E (Playwright)

# Lint e tipos
npm run lint
npx tsc --noEmit
```
