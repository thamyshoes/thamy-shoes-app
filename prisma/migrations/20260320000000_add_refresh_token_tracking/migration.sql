-- Adiciona campos para rastrear expiração do refresh_token (30 dias)
-- e mutex para evitar race condition no refresh concorrente
ALTER TABLE "bling_connections"
  ADD COLUMN "refresh_token_expires_at" TIMESTAMP(3),
  ADD COLUMN "is_refreshing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refreshing_at" TIMESTAMP(3);

-- Preencher refresh_token_expires_at para conexões existentes
-- Estima 30 dias a partir de agora (conservador — pode ser menos se token é antigo)
UPDATE "bling_connections"
SET "refresh_token_expires_at" = NOW() + INTERVAL '30 days'
WHERE "refresh_token_expires_at" IS NULL;
