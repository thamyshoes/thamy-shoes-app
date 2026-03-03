import { toast } from 'sonner'
import { MESSAGES, ROUTES } from './constants'

class ApiError extends Error {
  retryAfter?: number
  constructor(
    message: string,
    public status: number,
    options?: { retryAfter?: number },
  ) {
    super(message)
    this.name = 'ApiError'
    this.retryAfter = options?.retryAfter
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (response.status === 401) {
    toast.error(MESSAGES.ERROR.UNAUTHORIZED)
    if (typeof window !== 'undefined') {
      window.location.href = ROUTES.LOGIN
    }
    throw new ApiError(MESSAGES.ERROR.UNAUTHORIZED, 401)
  }

  if (response.status === 403) {
    toast.error(MESSAGES.ERROR.FORBIDDEN)
    throw new ApiError(MESSAGES.ERROR.FORBIDDEN, 403)
  }

  if (response.status >= 500) {
    toast.error(MESSAGES.ERROR.GENERIC)
    throw new ApiError(MESSAGES.ERROR.GENERIC, response.status)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = (body as { error?: string }).error ?? MESSAGES.ERROR.GENERIC
    const retryAfter = response.status === 429
      ? parseInt(response.headers.get('Retry-After') ?? '', 10) || undefined
      : undefined
    throw new ApiError(message, response.status, { retryAfter })
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  const json = (await response.json()) as { data?: T } | T
  return (json as { data?: T }).data !== undefined ? (json as { data: T }).data : (json as T)
}

export const apiClient = {
  get<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'GET' })
  },
  post<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, { method: 'POST', body: JSON.stringify(body) })
  },
  put<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, { method: 'PUT', body: JSON.stringify(body) })
  },
  patch<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, { method: 'PATCH', body: JSON.stringify(body) })
  },
  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' })
  },
}

export { ApiError }
