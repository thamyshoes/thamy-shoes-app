'use client'

import { useState } from 'react'
import { Download, Eye, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { API_ROUTES, SETOR_LABELS } from '@/lib/constants'

export interface FichaWeb {
  id: string
  setor: string
  pedidoNumero: string
  createdAt: string
  totalCards: number
}

interface FichaCardWebProps {
  ficha: FichaWeb
  onVisualizar: (ficha: FichaWeb) => void
}

export function FichaCardWeb({ ficha, onVisualizar }: FichaCardWebProps) {
  const [downloading, setDownloading] = useState(false)

  const label = SETOR_LABELS[ficha.setor] ?? ficha.setor
  const dataFormatada = (() => {
    try {
      return format(parseISO(ficha.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
    } catch {
      return ficha.createdAt
    }
  })()

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(API_ROUTES.FICHA_DOWNLOAD_V2(ficha.id))
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error
        if (res.status === 404) {
          toast.error('Ficha não encontrada')
        } else {
          toast.error(msg ?? 'Erro ao baixar ficha')
        }
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ficha-${ficha.setor.toLowerCase()}-${ficha.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao baixar ficha. Tente novamente.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-4 shadow-sm',
        'hover:shadow-md transition-shadow',
      )}
      role="listitem"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="font-mono text-sm font-medium text-foreground">
          #{ficha.pedidoNumero}
        </span>
      </div>

      <p className="mb-1 text-xs text-secondary">{dataFormatada}</p>
      <p className="mb-4 text-sm text-foreground">
        {ficha.totalCards} {ficha.totalCards === 1 ? 'card' : 'cards'}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye className="h-3.5 w-3.5" />}
          onClick={() => onVisualizar(ficha)}
        >
          Visualizar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={
            downloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />
          }
          onClick={handleDownload}
          disabled={downloading}
          aria-label={downloading ? 'Baixando PDF...' : 'Baixar PDF'}
        >
          {downloading ? 'Baixando...' : 'Baixar'}
        </Button>
      </div>
    </div>
  )
}
