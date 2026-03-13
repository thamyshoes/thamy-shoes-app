// tests/load/scenarios/login.js
// Cenario: Login — POST /api/auth/login
// ATENCAO: Rate limit de 5 req/15min por IP. Cenarios de carga real
// devem usar IPs distintos (via proxy/headers) ou desabilitar rate limit.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const LOAD_TEST_USER = __ENV.LOAD_TEST_USER || 'loadtest@thamy.com'
const LOAD_TEST_PASS = __ENV.LOAD_TEST_PASS || 'LoadTest@123'
const errorRate = new Rate('errors')

const SLO_P95 = 800
const SLO_P99 = 2000

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 1, duration: '30s' },
    average_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      startTime: '30s',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${SLO_P95}`, `p(99)<${SLO_P99}`],
    errors: ['rate<0.05'],
    http_req_failed: ['rate<0.10'],
  },
}

export default function () {
  const payload = JSON.stringify({
    email: LOAD_TEST_USER,
    password: LOAD_TEST_PASS,
  })

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })

  const ok = check(res, {
    'login status 200 ou 401': (r) => r.status === 200 || r.status === 401,
    'login nao e 500': (r) => r.status !== 500,
    'login latencia < SLO p95': (r) => r.timings.duration < SLO_P95,
  })

  errorRate.add(!ok)
  sleep(3)
}
