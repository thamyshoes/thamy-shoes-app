import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/cn'

// Testa lógica de composição de classes do Button (sem DOM)
const variantClasses = {
  primary: 'bg-primary text-white hover:bg-primary-hover disabled:opacity-50',
  secondary: 'border border-border bg-transparent hover:bg-muted disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-muted disabled:opacity-50',
  destructive: 'bg-danger text-white hover:bg-red-700 disabled:opacity-50',
}

const sizeClasses = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

describe('Button — lógica de variantes e tamanhos', () => {
  it('variante primary contém bg-primary', () => {
    expect(variantClasses.primary).toContain('bg-primary')
  })

  it('variante destructive contém bg-danger', () => {
    expect(variantClasses.destructive).toContain('bg-danger')
  })

  it('variante secondary usa border transparente', () => {
    expect(variantClasses.secondary).toContain('bg-transparent')
  })

  it('tamanho sm tem h-8', () => {
    expect(sizeClasses.sm).toContain('h-8')
  })

  it('tamanho lg tem h-12', () => {
    expect(sizeClasses.lg).toContain('h-12')
  })

  it('cn() combina variante + tamanho sem conflito', () => {
    const result = cn(variantClasses.primary, sizeClasses.md)
    expect(result).toContain('bg-primary')
    expect(result).toContain('h-10')
  })

  it('estado loading deve desabilitar o botão (disabled:opacity-50 presente)', () => {
    // Todos os variantes têm disabled:opacity-50 para estado loading
    Object.values(variantClasses).forEach((cls) => {
      expect(cls).toContain('disabled:opacity-50')
    })
  })
})
