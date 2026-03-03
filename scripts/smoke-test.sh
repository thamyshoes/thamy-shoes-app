#!/bin/bash
# smoke-test.sh — Smoke Tests Pós-Deploy
#
# Uso:
#   bash scripts/smoke-test.sh                         # Local (localhost:3000)
#   bash scripts/smoke-test.sh https://meu-app.vercel.app  # Staging/Produção
#
# Pré-requisito: curl + jq instalados

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✅ PASS${NC} — $desc (esperado: $expected)"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC} — $desc (esperado: $expected, recebido: $actual)"
    ((FAIL++))
  fi
}

echo ""
echo "══════════════════════════════════════════"
echo "  Smoke Tests — Thamy Shoes"
echo "  Base URL: $BASE_URL"
echo "══════════════════════════════════════════"
echo ""

# 1. Health check — status ok
HEALTH=$(curl -sf "$BASE_URL/api/health" 2>/dev/null | jq -r '.status' 2>/dev/null)
check "Health check: status ok" "ok" "$HEALTH"

# 2. Health check — database true
DB=$(curl -sf "$BASE_URL/api/health" 2>/dev/null | jq -r '.database' 2>/dev/null)
check "Health check: database true" "true" "$DB"

# 3. Login page carrega (HTTP 200)
STATUS=$(curl -so /dev/null -w '%{http_code}' "$BASE_URL/login" 2>/dev/null)
check "Login page: HTTP 200" "200" "$STATUS"

# 4. Auth flow — POST /api/auth/login com admin (deve retornar 200)
AUTH_STATUS=$(curl -so /dev/null -w '%{http_code}' \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@thamyshoes.com.br","password":"admin123"}' \
  2>/dev/null)
check "Auth login ADMIN: HTTP 200" "200" "$AUTH_STATUS"

# 5. API protegida sem cookie → 401
API_NO_AUTH=$(curl -so /dev/null -w '%{http_code}' "$BASE_URL/api/pedidos" 2>/dev/null)
check "API /api/pedidos sem cookie: HTTP 401" "401" "$API_NO_AUTH"

# 6. API protegida com cookie → 200
AUTH_COOKIE=$(curl -s -c - \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@thamyshoes.com.br","password":"admin123"}' \
  2>/dev/null | grep 'auth-token' | awk '{print $NF}')
API_WITH_AUTH=$(curl -so /dev/null -w '%{http_code}' \
  -b "auth-token=$AUTH_COOKIE" "$BASE_URL/api/pedidos" 2>/dev/null)
check "API /api/pedidos com cookie: HTTP 200" "200" "$API_WITH_AUTH"

# 7. Cron sem secret → 401
CRON_NO_AUTH=$(curl -so /dev/null -w '%{http_code}' \
  -X POST "$BASE_URL/api/cron/check-bling-token" 2>/dev/null)
check "Cron sem Authorization: HTTP 401" "401" "$CRON_NO_AUTH"

# 8. Cron GET sem secret → 401
CRON_GET=$(curl -so /dev/null -w '%{http_code}' \
  "$BASE_URL/api/cron/check-bling-token" 2>/dev/null)
check "Cron GET sem Authorization: HTTP 401" "401" "$CRON_GET"

# 9. Static assets Next.js carregam
NEXT_STATUS=$(curl -so /dev/null -w '%{http_code}' "$BASE_URL/_next/static/" 2>/dev/null)
# _next/static retorna 404 sem arquivo específico, mas o servidor responde
NEXT_UP=$([ "$NEXT_STATUS" != "000" ] && echo "up" || echo "down")
check "Servidor Next.js responde: up" "up" "$NEXT_UP"

# 10. Rota inexistente → 404
NOT_FOUND=$(curl -so /dev/null -w '%{http_code}' "$BASE_URL/rota-que-nao-existe-abc123" 2>/dev/null)
check "Rota inexistente: HTTP 404" "404" "$NOT_FOUND"

echo ""
echo "══════════════════════════════════════════"
echo "  Resultado: $PASS/$((PASS + FAIL)) testes passando"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}❌ $FAIL testes falharam${NC}"
  exit 1
else
  echo -e "  ${GREEN}✅ Todos os smoke tests passaram!${NC}"
fi
echo "══════════════════════════════════════════"
echo ""
