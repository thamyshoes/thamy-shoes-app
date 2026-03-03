const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const DATETIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date
}

export function formatDate(date: string | Date): string {
  return DATE_FORMATTER.format(toDate(date))
}

export function formatDateTime(date: string | Date): string {
  return DATETIME_FORMATTER.format(toDate(date))
}

export function formatRelativeDate(date: string | Date): string {
  const d = toDate(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `há ${diffDays} dias`
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semanas`
  if (diffDays < 365) return `há ${Math.floor(diffDays / 30)} meses`
  return `há ${Math.floor(diffDays / 365)} anos`
}

export function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value)
}

export function formatPares(total: number): string {
  return `${total} par${total !== 1 ? 'es' : ''}`
}
