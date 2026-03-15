-- AlterEnum
ALTER TYPE "CategoriaMaterial" ADD VALUE 'FACHETA';

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

-- CreateIndex
CREATE INDEX "referencias_categoria_idx" ON "referencias"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "referencias_codigo_categoria_key" ON "referencias"("codigo", "categoria");
