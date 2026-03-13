'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import Link from 'next/link'

interface ModeloSemVariante {
  codigo: string
  nome: string
}

interface CorSemVariante {
  codigo: string
  nome: string
  cor: string
}

interface PopoverAcaoProps {
  modelosSemVariante: ModeloSemVariante[]
  coresSemVariante: CorSemVariante[]
}

export function PopoverAcao({ modelosSemVariante, coresSemVariante }: PopoverAcaoProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Por que o botão está desabilitado?"
        aria-expanded={open}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          id="popover-motivo"
          className="absolute left-0 z-50 mt-1 max-w-xs rounded-md border border-border bg-background p-3 shadow-md"
          role="tooltip"
        >
          {modelosSemVariante.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium text-foreground">
                Modelos sem variante cadastrada:
              </p>
              <ul className="space-y-2">
                {modelosSemVariante.map((m) => (
                  <li key={m.codigo} className="text-xs">
                    <span className="font-mono font-medium">{m.codigo}</span>
                    {' — '}
                    <span className="text-secondary">{m.nome}</span>
                    <br />
                    <Link
                      href={`/configuracoes/modelos?search=${encodeURIComponent(m.codigo)}`}
                      className="text-primary hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      Cadastrar variante ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {coresSemVariante.length > 0 && (
            <>
              {modelosSemVariante.length > 0 && (
                <hr className="my-2 border-border" />
              )}
              <p className="mb-2 text-xs font-medium text-foreground">
                Cores do pedido sem variante correspondente:
              </p>
              <ul className="space-y-2">
                {coresSemVariante.map((c) => (
                  <li key={`${c.codigo}__${c.cor}`} className="text-xs">
                    <span className="font-mono font-medium">{c.codigo}</span>
                    {' — '}
                    <span className="text-secondary">{c.nome}</span>
                    {' '}
                    <span className="font-mono text-warning">cor {c.cor}</span>
                    <br />
                    <Link
                      href={`/configuracoes/modelos?search=${encodeURIComponent(c.codigo)}`}
                      className="text-primary hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      Cadastrar variante de cor ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
