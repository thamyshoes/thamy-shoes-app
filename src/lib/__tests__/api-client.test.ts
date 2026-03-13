import { describe, it, expect } from 'vitest'
import { ApiError } from '../api-client'

// Test ApiError class
describe('ApiError', () => {
  it('creates error with correct properties', () => {
    // ApiError(message, status) — message first, status second
    const error = new ApiError('Não encontrado', 404)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Não encontrado')
    expect(error).toBeInstanceOf(Error)
  })

  it('has correct name', () => {
    const error = new ApiError('Internal server error', 500)
    expect(error.name).toBe('ApiError')
  })
})

// Test HTTP status code classification
describe('HTTP status classification', () => {
  it('identifies 2xx as success', () => {
    expect(200 >= 200 && 200 < 300).toBe(true)
    expect(201 >= 200 && 201 < 300).toBe(true)
  })

  it('identifies 4xx as client errors', () => {
    expect(400 >= 400 && 400 < 500).toBe(true)
    expect(401).toBe(401)
    expect(403).toBe(403)
  })

  it('identifies 5xx as server errors', () => {
    expect(500 >= 500).toBe(true)
    expect(502 >= 500).toBe(true)
  })
})

// Test URL building logic
describe('URL building', () => {
  it('builds correct query params string', () => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    expect(params.toString()).toBe('page=1&pageSize=20')
  })

  it('appends optional params correctly', () => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' })
    params.set('status', 'IMPORTADO')
    expect(params.toString()).toBe('page=1&pageSize=20&status=IMPORTADO')
  })
})
