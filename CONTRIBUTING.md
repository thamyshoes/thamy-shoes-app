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

Nunca usar `prisma db push` contra um banco compartilhado (produção, staging ou o
banco de dev de outra pessoa). Foi exatamente isso que produziu o drift saneado em
02/09/2026: o schema de produção andou por fora e o histórico de migrations ficou
descrevendo um banco que não existia mais, o que tornou `prisma migrate deploy`
impossível de rodar. O CI agora tem um step (`Checar drift entre prisma/migrations
e schema.prisma`) que falha no mesmo commit se o histórico e o schema divergirem.

### A migration NÃO é aplicada automaticamente no deploy

O deploy de produção é feito pela integração Git da Vercel (todo push na `main`),
e ela **não roda migration nenhuma**. O `deploy-prod.yml` também não roda, de
propósito (ver o comentário no topo do arquivo). Aplicar uma mudança de schema em
produção é uma operação **manual e deliberada**, feita antes do deploy do código
que depende dela:

```bash
# com DATABASE_URL/DIRECT_URL apontando para produção em modo session (porta 5432)
npx prisma migrate status   # confere o que está pendente
npx prisma migrate deploy   # aplica
```

Ordem importa: coluna nova primeiro, código que usa a coluna depois. O caminho
inverso derruba produção entre o deploy e a migration.

### Baseline de 02/09/2026

`prisma/migrations/` tem uma única migration, `0_init`, gerada a partir do
`schema.prisma` e marcada como aplicada em produção via `prisma migrate resolve
--applied 0_init`. As 8 migrations anteriores foram removidas porque nunca
descreveram o banco real (só 1 das 8 estava registrada no `_prisma_migrations` de
produção, e com `checksum` `manual_apply`). Continuam recuperáveis no histórico do
git. Um banco vazio que rode `migrate deploy` hoje chega a um schema idêntico ao de
produção — isso foi verificado com `migrate diff` nas duas direções.

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
