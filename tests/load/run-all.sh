#!/bin/bash
# tests/load/run-all.sh
# Executa todos os cenarios de carga em sequencia.
#
# Uso:
#   ./tests/load/run-all.sh smoke             # 1 VU, 1 min (validacao)
#   ./tests/load/run-all.sh average_load      # 50 VUs, ramp up/down
#   ./tests/load/run-all.sh stress            # 200 VUs, ramp up/down
#
# Variaveis de ambiente:
#   BASE_URL        URL base (default: http://localhost:3000)
#   AUTH_TOKEN       Cookie auth-token para endpoints autenticados
#   LOAD_TEST_USER   Email do usuario de teste (login)
#   LOAD_TEST_PASS   Senha do usuario de teste (login)
#   TEST_PEDIDO_ID   ID de pedido para teste de geracao de fichas

set -euo pipefail

SCENARIO=${1:-smoke}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"

mkdir -p "${RESULTS_DIR}"

echo "================================================"
echo "  LOAD TEST — thamy-shoes (${SCENARIO})"
echo "  BASE_URL: ${BASE_URL:-http://localhost:3000}"
echo "================================================"
echo ""

SCENARIOS=(
  "health"
  "login"
  "pedidos-list"
  "fichas-list"
  "fichas-gerar"
  "fichas-consolidar"
  "modelos-list"
)

for s in "${SCENARIOS[@]}"; do
  echo "--- Executando: ${s} (${SCENARIO}) ---"
  k6 run \
    --env SCENARIO="${SCENARIO}" \
    --summary-export="${RESULTS_DIR}/${s}-${SCENARIO}.json" \
    "${SCRIPT_DIR}/scenarios/${s}.js" \
    2>&1 | tail -20
  echo ""
done

echo "================================================"
echo "  RESULTADOS em: ${RESULTS_DIR}/"
echo "================================================"
