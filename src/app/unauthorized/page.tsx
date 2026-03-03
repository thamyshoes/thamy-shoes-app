import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Acesso Negado',
}

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <ShieldOff className="mx-auto h-12 w-12 text-secondary" />
        <h1 className="text-2xl font-semibold text-foreground">Acesso Negado</h1>
        <p className="text-sm text-secondary">
          Você não tem permissão para acessar esta página. Se acredita que isso é um erro,
          entre em contato com o administrador do sistema.
        </p>
        <Link
          href="/pedidos"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Voltar para Pedidos
        </Link>
      </div>
    </div>
  )
}
