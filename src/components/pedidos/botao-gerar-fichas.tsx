'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PopoverAcao } from './popover-acao'
import { DialogSetores, type Setor } from './dialog-setores'
import { useVerificarVariantes } from '@/hooks/use-verificar-variantes'

interface BotaoGerarFichasProps {
  pedidoId: string
  temFacheta: boolean
  onGerado: () => void
}

export function BotaoGerarFichas({ pedidoId, temFacheta, onGerado }: BotaoGerarFichasProps) {
  const { data: verificacao, loading, error } = useVerificarVariantes(pedidoId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [gerando, setGerando] = useState(false)

  if (error) {
    toast.error(error)
  }

  async function handleConfirmarSetores(setores: Setor[]) {
    setGerando(true)
    try {
      const res = await fetch('/api/fichas/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, setores }),
      })
      if (!res.ok) {
        const errData = await res.json() as { error?: string }
        throw new Error(errData.error ?? 'Erro ao gerar fichas')
      }
      const result = await res.json() as { data?: { fichas?: unknown[] }; avisos?: string[] }
      const count = result?.data?.fichas?.length ?? 0
      toast.success(count > 0 ? `${count} fichas geradas com sucesso` : 'Fichas geradas com sucesso')
      if (result.avisos && result.avisos.length > 0) {
        for (const aviso of result.avisos) {
          toast.warning(aviso, { duration: 8000 })
        }
      }
      setDialogOpen(false)
      onGerado()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar fichas')
    } finally {
      setGerando(false)
    }
  }

  const disabled = !verificacao?.todosComVariante
  const showPopover = !loading && verificacao?.todosComVariante === false

  return (
    <div className="flex items-center gap-2">
      <Button
        data-testid="pedido-gerar-fichas-button"
        variant="primary"
        onClick={() => setDialogOpen(true)}
        disabled={disabled || loading}
        loading={loading}
        aria-disabled={disabled || loading}
        aria-describedby={showPopover ? 'popover-motivo' : undefined}
      >
        Gerar fichas
      </Button>

      {showPopover && verificacao && (
        <PopoverAcao
          modelosSemVariante={verificacao.modelosSemVariante}
          coresSemVariante={verificacao.coresSemVariante}
        />
      )}

      <DialogSetores
        open={dialogOpen}
        temFacheta={temFacheta}
        onClose={() => setDialogOpen(false)}
        onConfirm={(setores) => void handleConfirmarSetores(setores)}
        loading={gerando}
      />
    </div>
  )
}
