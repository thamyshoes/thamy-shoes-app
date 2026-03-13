-- ============================================================
-- MIGRAÇÃO FICHAS DE PRODUÇÃO V2
-- Executar no Supabase SQL Editor (NÃO usar prisma migrate)
-- Ordem: copiar e colar no SQL Editor e executar de uma vez
-- ============================================================

BEGIN;

-- ─── SAVEPOINT 1: Enum Setor — adicionar FACHETA ───────────
SAVEPOINT sp1;

-- Postgres não permite ALTER TYPE ADD VALUE dentro de transação com savepoints
-- em versões < 14. Supabase usa PostgreSQL 15+, portanto é seguro.
ALTER TYPE "Setor" ADD VALUE IF NOT EXISTS 'FACHETA';

-- ─── SAVEPOINT 2: Modelo — adicionar novos campos ──────────
SAVEPOINT sp2;

ALTER TABLE modelos
  ADD COLUMN IF NOT EXISTS material_cabedal   TEXT,
  ADD COLUMN IF NOT EXISTS material_sola      TEXT,
  ADD COLUMN IF NOT EXISTS material_palmilha  TEXT,
  ADD COLUMN IF NOT EXISTS material_facheta   TEXT,
  ADD COLUMN IF NOT EXISTS facheta            TEXT;

-- ─── SAVEPOINT 3: Modelo — converter tem_facheta antes de remover ──────────
SAVEPOINT sp3;

-- Converter tem_facheta=true para facheta='(a definir)' antes de dropar a coluna
UPDATE modelos
SET facheta = '(a definir)'
WHERE tem_facheta = true AND (facheta IS NULL OR facheta = '');

ALTER TABLE modelos
  DROP COLUMN IF EXISTS material_base_palmilha,
  DROP COLUMN IF EXISTS tem_facheta;

-- ─── SAVEPOINT 4: ModeloVarianteCor — renomear coluna ──────
SAVEPOINT sp4;

ALTER TABLE modelo_variantes_cor
  RENAME COLUMN cabedal_override TO cor_cabedal;

-- ─── SAVEPOINT 5: ModeloVarianteCor — adicionar colunas ────
SAVEPOINT sp5;

ALTER TABLE modelo_variantes_cor
  ADD COLUMN IF NOT EXISTS imagem_url   TEXT,
  ADD COLUMN IF NOT EXISTS cor_palmilha TEXT,
  ADD COLUMN IF NOT EXISTS cor_facheta  TEXT;

-- ─── SAVEPOINT 6: ModeloVarianteCor — remover colunas ──────
SAVEPOINT sp6;

ALTER TABLE modelo_variantes_cor
  DROP COLUMN IF EXISTS cor_forro_palmilha,
  DROP COLUMN IF EXISTS codigo_ficha_palmilha,
  DROP COLUMN IF EXISTS descricao_palmilha;

-- ─── SAVEPOINT 7: MapeamentoCor — adicionar hex ────────────
SAVEPOINT sp7;

ALTER TABLE mapeamentos_cor
  ADD COLUMN IF NOT EXISTS hex TEXT;

-- ─── VALIDAÇÃO BÁSICA ───────────────────────────────────────

-- Confirma que FACHETA existe no enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum pe
    JOIN pg_type pt ON pe.enumtypid = pt.oid
    WHERE pt.typname = 'Setor' AND pe.enumlabel = 'FACHETA'
  ) THEN
    RAISE EXCEPTION 'FACHETA não foi adicionado ao enum Setor';
  END IF;
END $$;

-- Confirma que material_cabedal existe em modelos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'modelos' AND column_name = 'material_cabedal'
  ) THEN
    RAISE EXCEPTION 'Coluna material_cabedal não encontrada em modelos';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- Após executar este SQL com sucesso:
--   1. npx prisma db pull  (sincroniza schema local)
--   2. npx prisma generate (atualiza Prisma Client)
--   3. npx prisma validate (confirma schema sem erros)
-- ============================================================
