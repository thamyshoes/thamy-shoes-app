-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'PCP', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "Setor" AS ENUM ('CABEDAL', 'PALMILHA', 'SOLA', 'FACHETA');

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

-- CreateEnum
CREATE TYPE "CategoriaMaterial" AS ENUM ('CABEDAL', 'SOLA', 'PALMILHA', 'FACHETA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "setores" "Setor"[] DEFAULT ARRAY[]::"Setor"[],
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
    "refresh_token_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL,
    "status" "StatusConexao" NOT NULL,
    "is_refreshing" BOOLEAN NOT NULL DEFAULT false,
    "refreshing_at" TIMESTAMP(3),
    "last_sync_produtos_at" TIMESTAMPTZ(6),
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
    "produto_id" TEXT,
    "modelo_id" TEXT,
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
    "modo" TEXT NOT NULL DEFAULT 'SEPARADOR',
    "separador" TEXT NOT NULL DEFAULT '-',
    "ordem" JSONB NOT NULL,
    "segmentos" JSONB NOT NULL,
    "digitos_sufixo" JSONB,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "id_bling" BIGINT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "imagem_url" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaMaterial" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referencias" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaMaterial" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cabedal" TEXT,
    "sola" TEXT,
    "palmilha" TEXT,
    "material_cabedal" TEXT,
    "material_sola" TEXT,
    "material_palmilha" TEXT,
    "material_facheta" TEXT,
    "facheta" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo_variantes_cor" (
    "id" TEXT NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "cor_codigo" TEXT NOT NULL,
    "imagem_url" TEXT,
    "cor_cabedal" TEXT,
    "cor_sola" TEXT,
    "cor_palmilha" TEXT,
    "cor_facheta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelo_variantes_cor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapeamentos_cor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "hex" TEXT,
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

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "itens_pedido_produto_id_idx" ON "itens_pedido"("produto_id");

-- CreateIndex
CREATE INDEX "itens_pedido_modelo_id_idx" ON "itens_pedido"("modelo_id");

-- CreateIndex
CREATE INDEX "itens_pedido_status_idx" ON "itens_pedido"("status");

-- CreateIndex
CREATE INDEX "itens_pedido_modelo_cor_idx" ON "itens_pedido"("modelo", "cor");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_id_bling_key" ON "produtos"("id_bling");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_codigo_key" ON "produtos"("codigo");

-- CreateIndex
CREATE INDEX "produtos_codigo_idx" ON "produtos"("codigo");

-- CreateIndex
CREATE INDEX "materiais_categoria_idx" ON "materiais"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "materiais_nome_categoria_key" ON "materiais"("nome", "categoria");

-- CreateIndex
CREATE INDEX "referencias_categoria_idx" ON "referencias"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "referencias_codigo_categoria_key" ON "referencias"("codigo", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_codigo_key" ON "modelos"("codigo");

-- CreateIndex
CREATE INDEX "modelos_codigo_idx" ON "modelos"("codigo");

-- CreateIndex
CREATE INDEX "modelo_variantes_cor_modelo_id_idx" ON "modelo_variantes_cor"("modelo_id");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_variantes_cor_modelo_id_cor_codigo_key" ON "modelo_variantes_cor"("modelo_id", "cor_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "mapeamentos_cor_codigo_key" ON "mapeamentos_cor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "grades_modelo_modelo_unique" ON "grades_modelo"("modelo");

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

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelo_variantes_cor" ADD CONSTRAINT "modelo_variantes_cor_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

