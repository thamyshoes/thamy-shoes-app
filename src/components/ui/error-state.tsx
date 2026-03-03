import { AlertCircle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  icon?: React.ReactNode
}

export function ErrorState({
  title = 'Erro ao carregar',
  description = 'Não foi possível carregar os dados.',
  onRetry,
  icon,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        {icon ?? <AlertCircle className="h-6 w-6 text-destructive" />}
      </div>

      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-secondary">{description}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 text-sm font-medium text-foreground underline underline-offset-2 hover:text-primary"
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}
