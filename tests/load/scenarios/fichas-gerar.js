// tests/load/scenarios/fichas-gerar.js
// Cenario: Gerar fichas de producao — POST /api/fichas/gerar
// Operacao pesada (gera PDFs). Rate limit: 30 req/min por IP.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''
const TEST_PEDIDO_ID = __ENV.TEST_PEDIDO_ID || 'test-pedido-001'
const errorRate = new Rate('errors')

const SLO_P95 = 5000
const SLO_P99 = 10000

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 1, duration: '1m' },
    average_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 0 },
      ],
      startTime: '1m',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${SLO_P95}`, `p(99)<${SLO_P99}`],
    errors: ['rate<0.05'],
    http_req_failed: ['rate<0.10'],
  },
}

export default function () {
  const headers = { 'Content-Type': 'application/json' }
  if (AUTH_TOKEN) headers['Cookie'] = `auth-token=${AUTH_TOKEN}`

  const payload = JSON.stringify({
    pedidoId: TEST_PEDIDO_ID,
    setores: ['CABEDAL', 'PALMILHA', 'SOLA'],
  })

  const res = http.post(`${BASE_URL}/api/fichas/gerar`, payload, { headers })

  const ok = check(res, {
    'gerar fichas status 200 ou 429': (r) => r.status === 200 || r.status === 429,
    'gerar fichas nao e 500': (r) => r.status !== 500,
    'gerar fichas latencia < SLO p95': (r) => r.timings.duration < SLO_P95,
  })

  errorRate.add(!ok)
  sleep(3)
}
