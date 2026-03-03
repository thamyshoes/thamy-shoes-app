-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'PCP', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "Setor" AS ENUM ('CABEDAL', 'PALMILHA', 'SOLA');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('IMPORTADO', 'PENDENTE_AJUSTE', 'FICHAS_GERADAS');

-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('PENDENTE', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('DESCONECTADO', 'CONECTADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "EscopoEquivalencia" AS ENUM ('REFERENCIA', 'GLOBAL');

-- CreateEnum
CREATE TYPE "TipoCampo" AS ENUM ('TEXTO', 'NUMERO', 'SELECAO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "setor" "Setor",
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bling_connections" (
    "id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL,
    "status" "StatusConexao" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bling_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_compra" (
    "id" TEXT NOT NULL,
    "id_bling" BIGINT NOT NULL,
    "numero" TEXT NOT NULL,
    "data_emissao" DATE NOT NULL,
    "data_prevista" DATE,
    "fornecedor_nome" TEXT NOT NULL,
    "fornecedor_id" BIGINT,
    "observacoes" TEXT,
    "status" "StatusPedido" NOT NULL DEFAULT 'IMPORTADO',
    "importado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "descricao_bruta" TEXT NOT NULL,
    "sku_bruto" TEXT,
    "quantidade" INTEGER NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "modelo" TEXT,
    "cor" TEXT,
    "cor_descricao" TEXT,
    "tamanho" INTEGER,
    "variacoes" JSONB,
    "status" "StatusItem" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_sku" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "separador" TEXT NOT NULL,
    "ordem" JSONB NOT NULL,
    "segmentos" JSONB NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapeamentos_cor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapeamentos_cor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades_numeracao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tamanho_min" INTEGER NOT NULL,
    "tamanho_max" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_numeracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades_modelo" (
    "id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_equivalencia" (
    "id" TEXT NOT NULL,
    "escopo" "EscopoEquivalencia" NOT NULL,
    "valor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_equivalencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidados" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consolidados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidados_pedidos" (
    "consolidado_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,

    CONSTRAINT "consolidados_pedidos_pkey" PRIMARY KEY ("consolidado_id","pedido_id")
);

-- CreateTable
CREATE TABLE "fichas_producao" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "consolidado_id" TEXT,
    "setor" "Setor" NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "total_pares" INTEGER NOT NULL,
    "dados_json" JSONB,
    "extra_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichas_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campos_extras" (
    "id" TEXT NOT NULL,
    "setor" "Setor" NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCampo" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campos_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao_log" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "conteudo" TEXT,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_perfil_idx" ON "users"("perfil");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_compra_id_bling_key" ON "pedidos_compra"("id_bling");

-- CreateIndex
CREATE INDEX "pedidos_compra_status_idx" ON "pedidos_compra"("status");

-- CreateIndex
CREATE INDEX "pedidos_compra_created_at_idx" ON "pedidos_compra"("created_at" DESC);

-- CreateIndex
CREATE INDEX "itens_pedido_pedido_id_idx" ON "itens_pedido"("pedido_id");

-- CreateIndex
CREATE INDEX "itens_pedido_status_idx" ON "itens_pedido"("status");

-- CreateIndex
CREATE INDEX "itens_pedido_modelo_cor_idx" ON "itens_pedido"("modelo", "cor");

-- CreateIndex
CREATE UNIQUE INDEX "mapeamentos_cor_codigo_key" ON "mapeamentos_cor"("codigo");

-- CreateIndex
CREATE INDEX "grades_modelo_modelo_idx" ON "grades_modelo"("modelo");

-- CreateIndex
CREATE UNIQUE INDEX "grades_modelo_grade_id_modelo_key" ON "grades_modelo"("grade_id", "modelo");

-- CreateIndex
CREATE INDEX "fichas_producao_pedido_id_idx" ON "fichas_producao"("pedido_id");

-- CreateIndex
CREATE INDEX "fichas_producao_consolidado_id_idx" ON "fichas_producao"("consolidado_id");

-- CreateIndex
CREATE INDEX "fichas_producao_setor_created_at_idx" ON "fichas_producao"("setor", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "campos_extras_setor_nome_key" ON "campos_extras"("setor", "nome");

-- CreateIndex
CREATE INDEX "notificacao_log_tipo_enviado_em_idx" ON "notificacao_log"("tipo", "enviado_em");

-- AddForeignKey
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades_modelo" ADD CONSTRAINT "grades_modelo_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades_numeracao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidados_pedidos" ADD CONSTRAINT "consolidados_pedidos_consolidado_id_fkey" FOREIGN KEY ("consolidado_id") REFERENCES "consolidados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consolidados_pedidos" ADD CONSTRAINT "consolidados_pedidos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_producao" ADD CONSTRAINT "fichas_producao_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_producao" ADD CONSTRAINT "fichas_producao_consolidado_id_fkey" FOREIGN KEY ("consolidado_id") REFERENCES "consolidados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
