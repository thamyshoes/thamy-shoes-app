'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { ROUTES, API_ROUTES } from '@/lib/constants'

export interface PedidoItemConsolidado {
  id: string
  numero: string
  cliente: string
  totalItens: number
}

interface ConsolidadoPageProps {
  pedidos: PedidoItemConsolidado[]
}

interface ConsolidadoResultado {
  setor: string
  pdfBase64: string
  totalCards: number
  chunks: number
}

const SETORES_PADRAO = ['CABEDAL', 'SOLA', 'PALMILHA'] as const

function BotaoGerarIndividual({ pedidoId, disabled }: { pedidoId: string; disabled: boolean }) {
  const [gerando, setGerando] = useState(false)
  const router = useRouter()

  async function handleGerar(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setGerando(true)
    try {
      const res = await fetch(API_ROUTES.FICHAS_GERAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast.error(data.error ?? 'Erro ao gerar fichas')
        return
      }
      const result = await res.json() as { data?: { fichas?: unknown[] }; avisos?: string[] }
      const count = result?.data?.fichas?.length ?? 0
      toast.success(count > 0 ? `${count} fichas geradas com sucesso` : 'Fichas geradas')
      if (result.avisos) {
        for (const aviso of result.avisos) toast.warning(aviso, { duration: 8000 })
      }
      router.push(ROUTES.FICHAS)
    } catch {
      toast.error('Erro ao gerar fichas. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
      onClick={handleGerar}
      disabled={disabled || gerando}
    >
      {gerando ? 'Gerando...' : 'Gerar Individual'}
    </Button>
  )
}

const ITEMS_POR_PAGINA = 15

// ST002: Client Component com estado de seleção
export function ConsolidadoPage({ pedidos }: ConsolidadoPageProps) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [agruparPorFaixa, setAgruparPorFaixa] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)

  const totalPaginas = Math.max(1, Math.ceil(pedidos.length / ITEMS_POR_PAGINA))
  const pedidosPaginados = pedidos.slice(
    (paginaAtual - 1) * ITEMS_POR_PAGINA,
    paginaAtual * ITEMS_POR_PAGINA,
  )

  // ST002: Toggle individual de pedido
  const togglePedido = (id: string) => {
    if (isLoading) return
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // ST006: Handler com POST /api/consolidar e download dos PDFs
  const handleGerar = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/consolidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoIds: selecionados, setores: [...SETORES_PADRAO], agruparPorFaixa }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Erro ao gerar consolidado')
      }

      const resultados = (await res.json()) as ConsolidadoResultado[]

      // Download automático de 1 PDF por setor
      let successCount = 0
      let failCount = 0
      for (const r of resultados) {
        try {
          const bytes = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0))
          const blob = new Blob([bytes], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `consolidado-${r.setor.toLowerCase()}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          successCount++
        } catch {
          failCount++
        }
      }

      if (failCount === 0) {
        toast.success(
          `${successCount} PDF${successCount !== 1 ? 's' : ''} gerado${successCount !== 1 ? 's' : ''} com sucesso!`,
        )
      } else if (successCount > 0) {
        toast.warning(
          `${successCount} de ${resultados.length} PDFs gerados. ${failCount} falhou ao baixar.`,
        )
      } else {
        toast.error('Erro ao baixar os PDFs gerados. Tente novamente.')
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao gerar consolidado. Tente novamente.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Auth loading: skeleton em vez de null
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isButtonDisabled = selecionados.length === 0 || isLoading

  return (
    <SidebarLayout user={user}>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-secondary">
        <Link href={ROUTES.PEDIDOS} className="hover:text-foreground transition-colors">
          Pedidos
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Gerar Consolidado</span>
      </nav>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gerar Consolidado</h1>
          <p className="mt-1 text-sm text-secondary">Selecione os pedidos para consolidar:</p>
        </div>

        {/* ST005: Empty state */}
        {pedidos.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>Nenhum pedido ativo disponível para consolidar.</p>
          </div>
        ) : (
          <>
            {/* ST003: Lista de pedidos como cards com checkbox */}
            <div
              className="overflow-hidden rounded-lg border"
              role="group"
              aria-label="Lista de pedidos para consolidar"
            >
              {pedidosPaginados.map((pedido) => {
                const selecionado = selecionados.includes(pedido.id)
                return (
                  <div
                    key={pedido.id}
                    className={`flex items-center gap-3 border-b px-4 py-3 last:border-0 transition-colors ${
                      isLoading
                        ? 'pointer-events-none opacity-60'
                        : `cursor-pointer ${selecionado ? 'bg-accent/10' : 'hover:bg-muted'}`
                    }`}
                    onClick={() => togglePedido(pedido.id)}
                  >
                    <input
                      id={pedido.id}
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => togglePedido(pedido.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isLoading}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Selecionar pedido ${pedido.numero}`}
                    />
                    <label
                      htmlFor={pedido.id}
                      className="flex flex-1 cursor-pointer items-center gap-2"
                      onClick={(e) => e.preventDefault()}
                    >
                      <span className="font-medium">#{pedido.numero}</span>
                      <span className="text-muted-foreground">{pedido.cliente}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <BotaoGerarIndividual
                          pedidoId={pedido.id}
                          disabled={isLoading}
                        />
                        <span className="text-xs text-muted-foreground">
                          {pedido.totalItens} {pedido.totalItens === 1 ? 'item' : 'itens'}
                        </span>
                      </span>
                    </label>
                  </div>
                )
              })}
            </div>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  Página {paginaAtual} de {totalPaginas} ({pedidos.length} pedidos)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1 || isLoading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas || isLoading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}

            {/* Contador de seleção (aria-live para screen readers) */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {selecionados.length} pedido{selecionados.length !== 1 ? 's' : ''} selecionado
              {selecionados.length !== 1 ? 's' : ''}
            </p>

            {/* ST002: Toggle agrupar por faixa de numeração */}
            <div className="flex items-center gap-3 pt-2">
              <button
                id="toggle-faixa"
                type="button"
                role="switch"
                aria-checked={agruparPorFaixa}
                onClick={() => setAgruparPorFaixa((v) => !v)}
                disabled={isLoading}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                  agruparPorFaixa ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    agruparPorFaixa ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <label
                htmlFor="toggle-faixa"
                className="cursor-pointer select-none text-sm text-foreground"
              >
                Agrupar por faixa{' '}
                <span className="text-muted-foreground">(Infantil ≤27 / Adulto ≥28)</span>
              </label>
            </div>

            {/* ST004: Botão "Gerar consolidado" com validação */}
            <Button
              onClick={handleGerar}
              disabled={isButtonDisabled}
              loading={isLoading}
              title={selecionados.length === 0 ? 'Selecione ao menos 1 pedido' : undefined}
              aria-disabled={isButtonDisabled}
              className="mt-6"
            >
              {isLoading
                ? 'Gerando...'
                : `Gerar consolidado (${selecionados.length} pedido${selecionados.length !== 1 ? 's' : ''})`}
            </Button>
          </>
        )}
      </div>
    </SidebarLayout>
  )
}
