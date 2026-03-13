'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
      <p className="text-lg font-medium text-foreground">
        Erro ao carregar pedidos
      </p>
      <p className="text-sm text-muted-foreground">
        Algo deu errado ao buscar os pedidos. Tente novamente.
      </p>
      <Button onClick={reset} variant="secondary">
        Tentar novamente
      </Button>
    </div>
  )
}
