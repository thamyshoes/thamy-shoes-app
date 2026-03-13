// tests/load/scenarios/pedidos-list.js
// Cenario: Listagem de pedidos — GET /api/pedidos
// Endpoint de alta frequencia (pagina principal da aplicacao).
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
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      startTime: '1m',
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      startTime: '10m',
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

  const res = http.get(`${BASE_URL}/api/pedidos?page=1&limit=20`, { headers })

  const ok = check(res, {
    'pedidos status 200': (r) => r.status === 200,
    'pedidos retorna array': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Array.isArray(body.data || body)
      } catch {
        return false
      }
    },
    'pedidos latencia < SLO p95': (r) => r.timings.duration < SLO_P95,
  })

  errorRate.add(!ok)
  sleep(1)
}
