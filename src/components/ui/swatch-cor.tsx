import { cn } from '@/lib/cn'

interface SwatchCorProps {
  hex?: string | null
  nome?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Preview visual de uma cor. Mostra um quadrado colorido com o hex fornecido.
 * Se hex for null/undefined, exibe um quadrado cinza tracejado.
 */
export function SwatchCor({ hex, nome, size = 'md', className }: SwatchCorProps) {
  const isValid = hex && /^#[0-9A-Fa-f]{6}$/.test(hex)
  const isWhite = isValid && hex?.toLowerCase() === '#ffffff'

  const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  if (!isValid) {
    return (
      <span
        className={cn(
          sizeClass,
          'inline-block shrink-0 rounded-[4px] border border-dashed border-muted-foreground/40 bg-muted',
          className,
        )}
        aria-label={nome ? `Cor ${nome} sem hex definido` : 'Cor sem hex definido'}
        title="Cor não definida"
      />
    )
  }

  return (
    <span
      className={cn(
        sizeClass,
        'inline-block shrink-0 rounded-[4px]',
        isWhite ? 'border border-muted-foreground/30' : 'border border-transparent',
        className,
      )}
      style={{ backgroundColor: hex! }}
      aria-label={nome ? `Cor ${nome} (${hex})` : `Cor ${hex}`}
      title={nome ?? hex!}
    />
  )
}
