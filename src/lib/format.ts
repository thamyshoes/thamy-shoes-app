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

const BR_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function toDate(date: string | Date): Date {
  if (typeof date !== 'string') return date

  const parsed = parseDateBr(date)
  if (parsed) return parsed

  return new Date(date)
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

export function normalizeDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function formatDateInput(value: string): string {
  const trimmed = value.trim()
  const isoMatch = trimmed.match(ISO_DATE_REGEX)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }
  return trimmed
}

export function parseDateBr(value: string): Date | null {
  const trimmed = value.trim()
  let day: number
  let month: number
  let year: number

  const brMatch = trimmed.match(BR_DATE_REGEX)
  if (brMatch) {
    day = Number(brMatch[1])
    month = Number(brMatch[2])
    year = Number(brMatch[3])
  } else {
    const isoMatch = trimmed.match(ISO_DATE_REGEX)
    if (!isoMatch) return null
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function isValidDateInput(value: string): boolean {
  return parseDateBr(value) !== null
}

export function parseDateBrStart(value: string): Date | null {
  const date = parseDateBr(value)
  if (!date) return null
  date.setHours(0, 0, 0, 0)
  return date
}

export function parseDateBrEnd(value: string): Date | null {
  const date = parseDateBr(value)
  if (!date) return null
  date.setHours(23, 59, 59, 999)
  return date
}
