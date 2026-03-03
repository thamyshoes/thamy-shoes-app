'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { CheckCircle, AlertTriangle, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiClient } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import { useAuth } from '@/hooks/use-auth'
import { useBlingStatus } from '@/hooks/use-bling-status'
import { API_ROUTES, MESSAGES } from '@/lib/constants'
import { StatusConexao } from '@/types'

// ── Cartão: Conectado ──────────────────────────────────────────────────────────

function ConnectedCard({
  expiresAt,
  connectedAt,
  onDisconnect,
}: {
  expiresAt: Date | null
  connectedAt: Date | null
  onDisconnect: () => void
}) {
  const expiry = expiresAt ? formatDateTime(expiresAt) : '—'

  return (
    <div className="rounded-lg border border-success/30 bg-success/10 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-success" />
        <span className="font-semibold text-foreground">Bling Conectado</span>
      </div>
      {connectedAt && (
        <p className="text-sm text-secondary">
          Conectado em: <span className="font-medium">{formatDateTime(connectedAt)}</span>
        </p>
      )}
      <p className="text-sm text-secondary">
        Token expira em: <span className="font-medium">{expiry}</span>
      </p>
      <Button variant="ghost" onClick={onDisconnect}>
        Desconectar
      </Button>
    </div>
  )
}

// ── Cartão: Token Expirado ─────────────────────────────────────────────────────

function ExpiredCard() {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <span className="font-semibold text-foreground">Token Expirado</span>
      </div>
      <p className="text-sm text-secondary">
        A conexão com o Bling expirou. Reconecte para continuar importando pedidos.
      </p>
      <Button variant="primary" onClick={() => { window.location.href = '/api/bling/connect' }}>
        Reconectar
      </Button>
    </div>
  )
}

// ── Cartão: Desconectado ───────────────────────────────────────────────────────

function DisconnectedCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <WifiOff className="h-5 w-5 text-secondary" />
        <span className="font-semibold text-foreground">Bling Desconectado</span>
      </div>
      <p className="text-sm text-secondary">
        Conecte sua conta Bling para importar pedidos automaticamente.
      </p>
      <Button variant="primary" onClick={() => { window.location.href = '/api/bling/connect' }}>
        Conectar Bling
      </Button>
    </div>
  )
}

// ── Cartão: Configuração Incompleta ───────────────────────────────────────────

function MissingConfigCard() {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <span className="font-semibold text-foreground">Configuração Incompleta</span>
      </div>
      <p className="text-sm text-secondary">
        Para conectar com o Bling, configure as variáveis no arquivo <code className="font-mono">.env</code>:
      </p>
      <ul className="text-sm text-secondary list-disc pl-5">
        <li><code className="font-mono">BLING_CLIENT_ID</code></li>
        <li><code className="font-mono">BLING_CLIENT_SECRET</code></li>
        <li><code className="font-mono">BLING_REDIRECT_URI</code></li>
      </ul>
      <p className="text-sm text-secondary">
        Depois de salvar, reinicie o servidor para aplicar.
      </p>
    </div>
  )
}

// ── Mensagens de erro OAuth ──────────────────────────────────────────────────

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Falha na autenticação: estado inválido. Tente novamente.',
  no_code: 'Falha na autenticação: código não recebido. Tente novamente.',
  token_exchange_failed: 'Falha ao trocar token com o Bling. Tente novamente.',
  server_error: 'Erro interno ao conectar com o Bling. Tente novamente.',
  missing_env:
    'Configuração do Bling incompleta. Defina BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REDIRECT_URI no .env e reinicie o servidor.',
}

// ── Handler de callback OAuth (isolado para Suspense boundary) ─────────────────

function BlingCallbackHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'connected') {
      toast.success(MESSAGES.SUCCESS.CONNECTED)
      router.replace(pathname)
    } else if (error) {
      toast.error(OAUTH_ERROR_MESSAGES[error] ?? MESSAGES.ERROR.GENERIC)
      router.replace(pathname)
    }
  }, [searchParams, router, pathname])

  return null
}

// ── Página Principal ───────────────────────────────────────────────────────────

export default function BlingConfigPage() {
  const { user, loading: authLoading } = useAuth()
  const { status, expiresAt, connectedAt, configOk, loading, refetch } = useBlingStatus()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  async function handleDisconnect() {
    setConfirmLoading(true)
    try {
      await apiClient.post(API_ROUTES.BLING_DISCONNECT, {})
      toast.success(MESSAGES.SUCCESS.DISCONNECTED)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MESSAGES.ERROR.GENERIC)
    } finally {
      setConfirmLoading(false)
      setConfirmOpen(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <SidebarLayout user={user}>
      {/* Suspense boundary obrigatório para useSearchParams() no Next.js 15 */}
      <Suspense fallback={null}>
        <BlingCallbackHandler />
      </Suspense>

      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Integração Bling</h1>

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : !configOk ? (
          <MissingConfigCard />
        ) : status === StatusConexao.CONECTADO ? (
          <ConnectedCard
            expiresAt={expiresAt}
            connectedAt={connectedAt}
            onDisconnect={() => setConfirmOpen(true)}
          />
        ) : status === StatusConexao.EXPIRADO ? (
          <ExpiredCard />
        ) : (
          <DisconnectedCard />
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Desconectar do Bling?"
        description={MESSAGES.CONFIRM.DISCONNECT}
        confirmLabel="Desconectar"
        variant="danger"
        loading={confirmLoading}
        onConfirm={handleDisconnect}
        onClose={() => setConfirmOpen(false)}
      />
    </SidebarLayout>
  )
}
