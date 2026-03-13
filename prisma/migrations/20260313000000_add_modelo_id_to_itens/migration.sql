-- AlterTable
ALTER TABLE "itens_pedido" ADD COLUMN "modelo_id" TEXT;

-- CreateIndex
CREATE INDEX "itens_pedido_modelo_id_idx" ON "itens_pedido"("modelo_id");

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
