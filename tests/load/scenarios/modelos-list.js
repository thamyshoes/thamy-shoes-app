// tests/load/scenarios/modelos-list.js
// Cenario: Listagem de modelos — GET /api/configuracoes/modelos
// Endpoint de configuracao, frequencia media.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''
const errorRate = new Rate('errors')

const SLO_P95 = 400
const SLO_P99 = 800

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 1, duration: '1m' },
    average_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '2m', target: 0 },
      ],
      startTime: '1m',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${SLO_P95}`, `p(99)<${SLO_P99}`],
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.05'],
  },
}

export default function () {
  const headers = { 'Content-Type': 'application/json' }
  if (AUTH_TOKEN) headers['Cookie'] = `auth-token=${AUTH_TOKEN}`

  const res = http.get(`${BASE_URL}/api/configuracoes/modelos`, { headers })

  const ok = check(res, {
    'modelos status 200': (r) => r.status === 200,
    'modelos latencia < SLO p95': (r) => r.timings.duration < SLO_P95,
  })

  errorRate.add(!ok)
  sleep(1)
}
