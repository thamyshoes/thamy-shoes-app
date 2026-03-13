import Link from 'next/link'
import { Search } from 'lucide-react'
import { ROUTES } from '@/lib/constants'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Search className="h-10 w-10 text-secondary" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Página não encontrada
        </h1>
        <p className="mt-2 text-secondary">
          O endereço que você acessou não existe ou foi removido.
        </p>
      </div>

      <Link
        href={ROUTES.PEDIDOS}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        Voltar para pedidos
      </Link>
    </div>
  )
}
