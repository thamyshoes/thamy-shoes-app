// tests/load/scenarios/health.js
// Cenario: Health check — GET /api/health
// Valida que a API responde e o banco esta acessivel.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const errorRate = new Rate('errors')

const SLO_P95 = 200
const SLO_P99 = 500

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
  const res = http.get(`${BASE_URL}/api/health`)

  const ok = check(res, {
    'health status 200': (r) => r.status === 200,
    'health body has status': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.status === 'ok'
      } catch {
        return false
      }
    },
    'health latencia < SLO p95': (r) => r.timings.duration < SLO_P95,
  })

  errorRate.add(!ok)
  sleep(1)
}
