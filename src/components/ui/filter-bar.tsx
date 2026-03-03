import { cn } from '@/lib/cn'

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white px-4 py-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
