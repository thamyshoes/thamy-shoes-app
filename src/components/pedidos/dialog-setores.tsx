'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

export type Setor = 'CABEDAL' | 'SOLA' | 'PALMILHA' | 'FACHETA'

interface DialogSetoresProps {
  open: boolean
  temFacheta: boolean
  onClose: () => void
  onConfirm: (setores: Setor[]) => void
  loading?: boolean
}

const SETORES_BASE: { value: Setor; label: string }[] = [
  { value: 'CABEDAL', label: 'Cabedal' },
  { value: 'SOLA', label: 'Sola' },
  { value: 'PALMILHA', label: 'Palmilha' },
]

export function DialogSetores({
  open,
  temFacheta,
  onClose,
  onConfirm,
  loading,
}: DialogSetoresProps) {
  const [selecionados, setSelecionados] = useState<Set<Setor>>(
    new Set(['CABEDAL', 'SOLA', 'PALMILHA']),
  )

  const setores = temFacheta
    ? [...SETORES_BASE, { value: 'FACHETA' as Setor, label: 'Facheta' }]
    : SETORES_BASE

  function toggle(setor: Setor) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(setor)) {
        next.delete(setor)
      } else {
        next.add(setor)
      }
      return next
    })
  }

  function handleClose() {
    setSelecionados(new Set(['CABEDAL', 'SOLA', 'PALMILHA']))
    onClose()
  }

  function handleConfirm() {
    onConfirm(Array.from(selecionados) as Setor[])
  }

  const nenhum = selecionados.size === 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Selecionar Setores"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={nenhum || loading}
            loading={loading}
            aria-disabled={nenhum}
          >
            {loading ? 'Gerando...' : 'Confirmar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {setores.map(({ value, label }) => {
          const checked = selecionados.has(value)
          return (
            <label
              key={value}
              htmlFor={`setor-${value}`}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                id={`setor-${value}`}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(value)}
                disabled={loading}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          )
        })}
      </div>
    </Modal>
  )
}
