import { cn } from '@/lib/cn'

interface SkeletonProps {
  variant?: 'text' | 'card' | 'table-row' | 'circle'
  className?: string
}

export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        variant === 'text' && 'h-4 w-full',
        variant === 'card' && 'h-32 w-full',
        variant === 'table-row' && 'h-10 w-full',
        variant === 'circle' && 'h-10 w-10 rounded-full',
        className,
      )}
      aria-hidden="true"
    />
  )
}

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2" aria-label="Carregando..." aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} variant="text" className={j === 0 ? 'w-1/4' : 'flex-1'} />
          ))}
        </div>
      ))}
    </div>
  )
}
