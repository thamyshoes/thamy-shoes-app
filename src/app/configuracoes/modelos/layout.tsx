import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Modelos | Thamy Shoes',
  description: 'Gerenciamento de modelos de calçados com materiais por componente',
}

export default function ModelosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
