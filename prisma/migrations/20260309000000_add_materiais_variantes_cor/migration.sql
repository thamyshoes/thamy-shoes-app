-- CreateEnum
CREATE TYPE "CategoriaMaterial" AS ENUM ('CABEDAL', 'SOLA', 'PALMILHA');

-- CreateTable: materiais (catálogo de materiais por categoria)
CREATE TABLE "materiais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaMaterial" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable: modelo_variantes_cor (overrides por cor do produto)
CREATE TABLE "modelo_variantes_cor" (
    "id" TEXT NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "cor_codigo" TEXT NOT NULL,
    "cabedal_override" TEXT,
    "cor_sola" TEXT,
    "cor_facheta" TEXT,
    "cor_forro_palmilha" TEXT,
    "codigo_ficha_palmilha" TEXT,
    "descricao_palmilha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelo_variantes_cor_pkey" PRIMARY KEY ("id")
);

-- AlterTable: modelos (adicionar novos campos)
ALTER TABLE "modelos" ADD COLUMN "tem_facheta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "modelos" ADD COLUMN "material_base_palmilha" TEXT;
ALTER TABLE "modelos" ADD COLUMN "linha" TEXT;

-- CreateIndex
CREATE INDEX "materiais_categoria_idx" ON "materiais"("categoria");
CREATE UNIQUE INDEX "materiais_nome_categoria_key" ON "materiais"("nome", "categoria");

CREATE INDEX "modelo_variantes_cor_modelo_id_idx" ON "modelo_variantes_cor"("modelo_id");
CREATE UNIQUE INDEX "modelo_variantes_cor_modelo_id_cor_codigo_key" ON "modelo_variantes_cor"("modelo_id", "cor_codigo");

CREATE INDEX "modelos_linha_idx" ON "modelos"("linha");

-- AddForeignKey
ALTER TABLE "modelo_variantes_cor" ADD CONSTRAINT "modelo_variantes_cor_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: materiais de cabedal (extraídos dos dados reais)
INSERT INTO "materiais" ("id", "nome", "categoria", "created_at", "updated_at") VALUES
(gen_random_uuid(), 'SANTORINE', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'SANTORINE PU', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'SANTORINE PVC', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'VERNIZ PU', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'VERNIZ SINTÉTICO', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'SINTETICO SILVER', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'CROCO', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'ALTAR', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'TORUN', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'EMBORRACHADO', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'DUBLADO TWILTEX', 'CABEDAL', NOW(), NOW()),
(gen_random_uuid(), 'ELANCA', 'CABEDAL', NOW(), NOW());

-- Seed: referências de sola
INSERT INTO "materiais" ("id", "nome", "categoria", "created_at", "updated_at") VALUES
(gen_random_uuid(), '100', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'MEL', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '048', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'PAXAO', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '206', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'LETRINHA', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '980', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'SAPATILHA', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'ARGO', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'FLAT', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '300', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO 20 AO 27', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO 28 AO 34', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO 34 AO 39', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'ANNY', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '200', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '713', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '714', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '5020', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'TEXANA', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'CALCE FÁCIL', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'EMBORRACHADO', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), '018', 'SOLA', NOW(), NOW()),
(gen_random_uuid(), 'SCARPIN', 'SOLA', NOW(), NOW());

-- Seed: referências de palmilha
INSERT INTO "materiais" ("id", "nome", "categoria", "created_at", "updated_at") VALUES
(gen_random_uuid(), '100', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'MEL', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'SCARPIN', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '206', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'LETRINHA', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '018', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'SAPATILHA', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'ARGO', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'FLAT', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '300', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO 20 AO 27', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO 28 AO 34', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'COTURNO 34 AO 39', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'ANNY', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '200', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '713', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '714', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), '5020', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'TEXANA', 'PALMILHA', NOW(), NOW()),
(gen_random_uuid(), 'CALCE FÁCIL', 'PALMILHA', NOW(), NOW());
