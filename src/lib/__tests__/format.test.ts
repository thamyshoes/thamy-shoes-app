import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatRelativeDate,
  formatCurrency,
  formatPares,
  normalizeDateInput,
  formatDateInput,
  parseDateBr,
  isValidDateInput,
} from '../format'

describe('format', () => {
  describe('formatDate', () => {
    it('formats a Date object in pt-BR', () => {
      const date = new Date(2024, 0, 15) // 15 Jan 2024
      const result = formatDate(date)
      expect(result).toBe('15/01/2024')
    })

    it('formats a date string in pt-BR', () => {
      // Use local date constructor to avoid UTC-to-local timezone shift
      const date = new Date(2024, 5, 20) // June 20 2024 (month is 0-indexed)
      const result = formatDate(date)
      expect(result).toBe('20/06/2024')
    })
  })

  describe('formatDateTime', () => {
    it('includes hour and minute', () => {
      const date = new Date(2024, 0, 15, 14, 30) // 15 Jan 2024 14:30
      const result = formatDateTime(date)
      expect(result).toContain('15/01/2024')
      expect(result).toContain('14:30')
    })
  })

  describe('formatRelativeDate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15T12:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns "hoje" for same day', () => {
      expect(formatRelativeDate(new Date('2024-06-15T08:00:00'))).toBe('hoje')
    })

    it('returns "ontem" for yesterday', () => {
      expect(formatRelativeDate(new Date('2024-06-14T12:00:00'))).toBe('ontem')
    })

    it('returns "há N dias" for recent dates', () => {
      expect(formatRelativeDate(new Date('2024-06-10T12:00:00'))).toBe('há 5 dias')
    })

    it('returns "há N semanas" for dates within a month', () => {
      expect(formatRelativeDate(new Date('2024-05-22T12:00:00'))).toBe('há 3 semanas')
    })

    it('returns "há N meses" for dates within a year', () => {
      expect(formatRelativeDate(new Date('2024-01-15T12:00:00'))).toBe('há 5 meses')
    })

    it('returns "há N anos" for old dates', () => {
      expect(formatRelativeDate(new Date('2022-06-15T12:00:00'))).toBe('há 2 anos')
    })
  })

  describe('formatCurrency', () => {
    it('formats BRL currency', () => {
      const result = formatCurrency(1234.5)
      expect(result).toMatch(/1\.234,50/)
    })

    it('formats zero', () => {
      const result = formatCurrency(0)
      expect(result).toMatch(/0,00/)
    })
  })

  describe('formatPares', () => {
    it('returns "1 par" for singular', () => {
      expect(formatPares(1)).toBe('1 par')
    })

    it('returns "N pares" for plural', () => {
      expect(formatPares(0)).toBe('0 pares')
      expect(formatPares(2)).toBe('2 pares')
      expect(formatPares(100)).toBe('100 pares')
    })
  })

  describe('normalizeDateInput', () => {
    it('formats digits into dd/mm/aaaa', () => {
      expect(normalizeDateInput('1')).toBe('1')
      expect(normalizeDateInput('1501')).toBe('15/01')
      expect(normalizeDateInput('15012024')).toBe('15/01/2024')
    })
  })

  describe('formatDateInput', () => {
    it('converts ISO date to dd/mm/aaaa', () => {
      expect(formatDateInput('2024-01-15')).toBe('15/01/2024')
    })

    it('keeps Brazilian format as-is', () => {
      expect(formatDateInput('15/01/2024')).toBe('15/01/2024')
    })
  })

  describe('parseDateBr', () => {
    it('parses dd/mm/aaaa', () => {
      const date = parseDateBr('15/01/2024')
      expect(date).toBeInstanceOf(Date)
      expect(date?.getFullYear()).toBe(2024)
      expect(date?.getMonth()).toBe(0)
      expect(date?.getDate()).toBe(15)
    })

    it('parses yyyy-mm-dd for backward compatibility', () => {
      const date = parseDateBr('2024-01-15')
      expect(date).toBeInstanceOf(Date)
      expect(date?.getFullYear()).toBe(2024)
    })

    it('rejects invalid dates', () => {
      expect(parseDateBr('31/02/2024')).toBeNull()
      expect(parseDateBr('abc')).toBeNull()
    })
  })

  describe('isValidDateInput', () => {
    it('validates Brazilian format', () => {
      expect(isValidDateInput('15/01/2024')).toBe(true)
      expect(isValidDateInput('2024-01-15')).toBe(true)
      expect(isValidDateInput('15/13/2024')).toBe(false)
    })
  })
})
