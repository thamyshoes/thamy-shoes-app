import { redirect } from 'next/navigation'

// Root redirect — será substituído pelo module-3 (auth)
// Redireciona para /login enquanto auth não está implementado
export default function RootPage() {
  redirect('/login')
}
