'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Algo deu errado
        </h1>
        <p className="mt-2 text-secondary">
          Ocorreu um erro inesperado. Tente novamente.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <code className="mt-4 block max-w-md rounded bg-muted p-3 text-left text-xs text-foreground">
            {error.message}
          </code>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="primary" onClick={reset}>
          Tentar novamente
        </Button>
        <Link
          href={ROUTES.PEDIDOS}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
