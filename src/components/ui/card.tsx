import { cn } from '@/lib/cn'

interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'elevated'
  className?: string
}

export function Card({ children, variant = 'default', className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-4',
        variant === 'elevated' && 'shadow-md',
        variant === 'default' && 'shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
