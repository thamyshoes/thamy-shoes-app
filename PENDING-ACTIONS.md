# Acoes Pendentes

> Acoes manuais que precisam ser executadas fora do pipeline automatizado.

## Supabase SQL Editor

> **Gerado em:** 2026-03-13 | **Fonte:** prisma/schema.prisma + prisma/migrations/ + migration-fichas-v2.sql | **Modelo:** Sonnet

### Instrucoes

1. Acesse o SQL Editor do seu projeto Supabase
2. Revise o checklist de readiness no topo do SQL
3. Cole o SQL abaixo no editor
4. Clique em "Run" — o script é idempotente (seguro para re-executar)
5. Após executar: `npx prisma generate` para atualizar o Prisma Client

### O que este script cobre

**Bloco A — migration-fichas-v2 (idempotente):**
Inclui TUDO do arquivo `migration-fichas-v2.sql` com guards `IF NOT EXISTS` / `IF EXISTS`,
seguro mesmo que a migration já tenha sido executada manualmente.

**Bloco B — peças faltantes (NUNCA aplicadas):**
- Tabela `produtos` (vinculada ao Bling, referenciada por `itens_pedido`)
- Coluna `produto_id` em `itens_pedido` + FK + index
- Colunas `modo` e `digitos_sufixo` em `regras_sku` (necessárias para parser SUFIXO)
- Storage bucket `fichas-producao`

### Warnings

- **`ALTER TYPE ADD VALUE`** não pode rodar dentro de transação em PostgreSQL < 14. Supabase usa PostgreSQL 15+, portanto é seguro.
- **Renomear coluna** (`cabedal_override → cor_cabedal`): se já executado, o `DO $$` block detecta e pula automaticamente.
- **Storage bucket**: o SQL Editor tem permissão para inserir em `storage.buckets`. Se preferir criar via Dashboard (Storage > New Bucket), pule o Bloco D.
- **IMPORTANTE:** O SQL Editor bypassa RLS. Teste via SDK após executar.

### SQL Completo

```sql
-- ============================================================
-- THAMY SHOES — SUPABASE SQL EDITOR (SCRIPT CONSOLIDADO)
-- ============================================================
-- Gerado em: 2026-03-13
-- Fonte: prisma/schema.prisma + migrations 1-5 + migration-fichas-v2.sql
--
-- READINESS CHECKLIST:
-- [ ] Extensions necessárias: pgcrypto (builtin no Supabase)
-- [ ] Roles esperados: authenticated, anon, service_role
-- [ ] Supabase Auth: NÃO usado (auth próprio com password_hash)
-- [ ] Storage bucket necessário: fichas-producao
-- [ ] Tamanho estimado: ~8 KB
--
-- INSTRUCOES:
-- 1. Cole tudo no SQL Editor
-- 2. Clique em "Run"
-- 3. Verifique que não há erros no output
-- 4. Execute: npx prisma generate (local)
-- ============================================================


-- ============================================================
-- BLOCO A: FICHAS-V2 — Idempotente (inclui migration-fichas-v2.sql)
-- ============================================================
-- Safe para rodar mesmo que migration-fichas-v2.sql já foi executada.


-- ── A1: Enum Setor — adicionar FACHETA ──────────────────────
-- ALTER TYPE ADD VALUE não pode rodar dentro de transação em PG < 14.
-- Supabase usa PG 15+, mas executamos fora de transação por segurança.
ALTER TYPE "Setor" ADD VALUE IF NOT EXISTS 'FACHETA';


-- ── A2: Modelos — adicionar novos campos ────────────────────
ALTER TABLE "modelos"
  ADD COLUMN IF NOT EXISTS "material_cabedal"  TEXT,
  ADD COLUMN IF NOT EXISTS "material_sola"     TEXT,
  ADD COLUMN IF NOT EXISTS "material_palmilha" TEXT,
  ADD COLUMN IF NOT EXISTS "material_facheta"  TEXT,
  ADD COLUMN IF NOT EXISTS "facheta"           TEXT;


-- ── A3: Modelos — migrar e remover campos obsoletos ──────────
-- Migrar tem_facheta=true → facheta='(a definir)' antes de dropar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modelos' AND column_name = 'tem_facheta'
  ) THEN
    UPDATE "modelos"
    SET "facheta" = '(a definir)'
    WHERE "tem_facheta" = true AND ("facheta" IS NULL OR "facheta" = '');
  END IF;
END $$;

ALTER TABLE "modelos"
  DROP COLUMN IF EXISTS "material_base_palmilha",
  DROP COLUMN IF EXISTS "tem_facheta";


-- ── A4: ModeloVarianteCor — renomear cabedal_override → cor_cabedal ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modelo_variantes_cor' AND column_name = 'cabedal_override'
  ) THEN
    ALTER TABLE "modelo_variantes_cor"
      RENAME COLUMN "cabedal_override" TO "cor_cabedal";
  END IF;
END $$;


-- ── A5: ModeloVarianteCor — adicionar imagem_url, cor_palmilha ──────
ALTER TABLE "modelo_variantes_cor"
  ADD COLUMN IF NOT EXISTS "imagem_url"   TEXT,
  ADD COLUMN IF NOT EXISTS "cor_palmilha" TEXT,
  ADD COLUMN IF NOT EXISTS "cor_facheta"  TEXT;


-- ── A6: ModeloVarianteCor — remover colunas obsoletas ───────
ALTER TABLE "modelo_variantes_cor"
  DROP COLUMN IF EXISTS "cor_forro_palmilha",
  DROP COLUMN IF EXISTS "codigo_ficha_palmilha",
  DROP COLUMN IF EXISTS "descricao_palmilha";


-- ── A7: MapeamentoCor — adicionar hex ───────────────────────
ALTER TABLE "mapeamentos_cor"
  ADD COLUMN IF NOT EXISTS "hex" TEXT;


-- ── A8: Validação dos blocos A ────────────────────────────────
DO $$
BEGIN
  -- Valida FACHETA no enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum pe
    JOIN pg_type pt ON pe.enumtypid = pt.oid
    WHERE pt.typname = 'Setor' AND pe.enumlabel = 'FACHETA'
  ) THEN
    RAISE EXCEPTION 'ERRO: FACHETA não foi adicionado ao enum Setor';
  END IF;

  -- Valida material_cabedal em modelos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modelos' AND column_name = 'material_cabedal'
  ) THEN
    RAISE EXCEPTION 'ERRO: Coluna material_cabedal não encontrada em modelos';
  END IF;

  -- Valida imagem_url em modelo_variantes_cor
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modelo_variantes_cor' AND column_name = 'imagem_url'
  ) THEN
    RAISE EXCEPTION 'ERRO: Coluna imagem_url não encontrada em modelo_variantes_cor';
  END IF;

  RAISE NOTICE 'Bloco A: OK — fichas-v2 aplicado com sucesso.';
END $$;


-- ============================================================
-- BLOCO B: PEÇAS FALTANTES — Nunca aplicadas em nenhuma migration
-- ============================================================


-- ── B1: Tabela produtos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "produtos" (
  "id"         TEXT      NOT NULL,
  "id_bling"   BIGINT    NOT NULL,
  "nome"       TEXT      NOT NULL,
  "codigo"     TEXT      NOT NULL,
  "imagem_url" TEXT,
  "ativo"      BOOLEAN   NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "produtos_id_bling_key"
  ON "produtos"("id_bling");

CREATE UNIQUE INDEX IF NOT EXISTS "produtos_codigo_key"
  ON "produtos"("codigo");

CREATE INDEX IF NOT EXISTS "produtos_codigo_idx"
  ON "produtos"("codigo");


-- ── B2: itens_pedido — adicionar produto_id ─────────────────
ALTER TABLE "itens_pedido"
  ADD COLUMN IF NOT EXISTS "produto_id" TEXT;

-- FK: produto_id → produtos(id) com SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'itens_pedido_produto_id_fkey'
      AND table_name = 'itens_pedido'
  ) THEN
    ALTER TABLE "itens_pedido"
      ADD CONSTRAINT "itens_pedido_produto_id_fkey"
      FOREIGN KEY ("produto_id")
      REFERENCES "produtos"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "itens_pedido_produto_id_idx"
  ON "itens_pedido"("produto_id");


-- ── B3: regras_sku — adicionar modo e digitos_sufixo ────────
ALTER TABLE "regras_sku"
  ADD COLUMN IF NOT EXISTS "modo"           TEXT NOT NULL DEFAULT 'SEPARADOR',
  ADD COLUMN IF NOT EXISTS "digitos_sufixo" JSONB;


-- ── B4: Validação dos blocos B ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'produtos'
  ) THEN
    RAISE EXCEPTION 'ERRO: Tabela produtos não foi criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'itens_pedido' AND column_name = 'produto_id'
  ) THEN
    RAISE EXCEPTION 'ERRO: Coluna produto_id não encontrada em itens_pedido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regras_sku' AND column_name = 'modo'
  ) THEN
    RAISE EXCEPTION 'ERRO: Coluna modo não encontrada em regras_sku';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regras_sku' AND column_name = 'digitos_sufixo'
  ) THEN
    RAISE EXCEPTION 'ERRO: Coluna digitos_sufixo não encontrada em regras_sku';
  END IF;

  RAISE NOTICE 'Bloco B: OK — peças faltantes aplicadas com sucesso.';
END $$;


-- ============================================================
-- BLOCO C: STORAGE BUCKET
-- ============================================================
-- Cria o bucket fichas-producao (público) se não existir.
-- Se preferir criar via Dashboard: Storage > New Bucket > fichas-producao > Public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fichas-producao',
  'fichas-producao',
  true,
  52428800, -- 50 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RESUMO FINAL
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'THAMY SHOES — SQL EDITOR: CONCLUÍDO';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Bloco A (fichas-v2): FACHETA, material_*, imagem_url, hex';
  RAISE NOTICE 'Bloco B (missing):   produtos, itens_pedido.produto_id, regras_sku.modo/digitos_sufixo';
  RAISE NOTICE 'Bloco C (storage):   bucket fichas-producao';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS (localmente):';
  RAISE NOTICE '  npx prisma generate';
  RAISE NOTICE '  npx prisma validate';
  RAISE NOTICE '============================================================';
END $$;
```

### Estatisticas

| Item | Quantidade |
|------|-----------|
| Enums alterados | 1 (Setor + FACHETA) |
| Tabelas alteradas | 4 (modelos, modelo_variantes_cor, mapeamentos_cor, itens_pedido, regras_sku) |
| Tabelas criadas | 1 (produtos) |
| Colunas adicionadas | 11 |
| Colunas removidas | 5 |
| Colunas renomeadas | 1 |
| Indexes criados | 4 |
| FKs criadas | 1 |
| Storage buckets | 1 (fichas-producao) |
| Tamanho estimado | ~8 KB |
