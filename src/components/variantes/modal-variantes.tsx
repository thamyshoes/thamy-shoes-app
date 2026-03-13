'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SwatchCor } from '@/components/ui/swatch-cor'
import { UploadImagem } from './upload-imagem'
import { useCores } from '@/hooks/use-cores'
import { apiClient } from '@/lib/api-client'

export interface VarianteRow {
  id?: string
  corCodigo: string
  imagemUrl?: string | null
  corCabedal?: string | null
  corSola?: string | null
  corPalmilha?: string | null
  corFacheta?: string | null
  _deleted?: boolean
}

interface ModalVariantesProps {
  open: boolean
  modeloCodigo: string
  modeloNome: string
  modeloId: string
  initialVariantes?: VarianteRow[]
  onClose: () => void
  onSaved: () => void
}

const VAZIA: VarianteRow = {
  corCodigo: '',
  imagemUrl: null,
  corCabedal: null,
  corSola: null,
  corPalmilha: null,
  corFacheta: null,
}

export function ModalVariantes({
  open,
  modeloCodigo,
  modeloNome,
  modeloId,
  initialVariantes = [],
  onClose,
  onSaved,
}: ModalVariantesProps) {
  const { cores, loading: coresLoading } = useCores()
  const [variantes, setVariantes] = useState<VarianteRow[]>([])
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Set<number>>(new Set())
  const [confirmClose, setConfirmClose] = useState(false)
  const originalRef = useRef<string>('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      const init = initialVariantes.length > 0
        ? initialVariantes
        : [{ ...VAZIA }]
      setVariantes(init)
      originalRef.current = JSON.stringify(init)
      setHasChanges(false)
      setValidationErrors(new Set())
    }
  }, [open, initialVariantes])

  // Focus trap + ESC handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handleClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasChanges],
  )

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement
    document.addEventListener('keydown', handleKeyDown)

    requestAnimationFrame(() => {
      if (dialogRef.current) {
        const first = dialogRef.current.querySelector<HTMLElement>(
          'select:not([disabled]), button:not([disabled]), input:not([disabled])',
        )
        first?.focus()
      }
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [open, handleKeyDown])

  function markChanged() {
    setHasChanges(true)
  }

  function updateVariante(index: number, patch: Partial<VarianteRow>) {
    setVariantes((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
    // Clear validation error for this index if cor is now filled
    if (patch.corCodigo) {
      setValidationErrors((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
    markChanged()
  }

  function addVariante() {
    setVariantes((prev) => [...prev, { ...VAZIA }])
    markChanged()
  }

  function removeVariante(index: number) {
    const ativas = variantes.filter((v) => !v._deleted)
    if (ativas.length <= 1) {
      toast.warning('O modelo deve ter ao menos 1 variante')
      return
    }

    const v = variantes[index]
    if (v.id) {
      updateVariante(index, { _deleted: true })

      let cancelled = false
      const toastId = toast('Variante removida.', {
        duration: 5000,
        action: {
          label: 'Desfazer',
          onClick: () => {
            cancelled = true
            updateVariante(index, { _deleted: false })
          },
        },
      })

      setTimeout(() => {
        if (!cancelled) toast.dismiss(toastId)
      }, 5000)
    } else {
      setVariantes((prev) => prev.filter((_, i) => i !== index))
      markChanged()
    }
  }

  function validateBeforeSave(): boolean {
    const errors = new Set<number>()
    variantes.forEach((v, i) => {
      if (!v._deleted && !v.corCodigo.trim()) {
        errors.add(i)
      }
    })
    setValidationErrors(errors)
    if (errors.size > 0) {
      toast.error('Todas as variantes devem ter uma cor principal selecionada')
      return false
    }
    return true
  }

  async function handleSave() {
    if (!validateBeforeSave()) return

    setSaving(true)
    try {
      const payload = {
        modeloId,
        variantes: variantes
          .filter((v) => !v._deleted)
          .map((v) => ({
            id: v.id,
            corCodigo: v.corCodigo,
            imagemUrl: v.imagemUrl ?? null,
            corCabedal: v.corCabedal ?? null,
            corSola: v.corSola ?? null,
            corPalmilha: v.corPalmilha ?? null,
            corFacheta: v.corFacheta ?? null,
          })),
        deletedIds: variantes
          .filter((v) => v._deleted && v.id)
          .map((v) => v.id!),
      }

      await apiClient.put('/api/variantes/batch', payload)

      setHasChanges(false)
      toast.success('Variantes salvas com sucesso')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar variantes')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (hasChanges) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  function handleConfirmClose() {
    setConfirmClose(false)
    onClose()
  }

  if (!open) return null

  const ativas = variantes.filter((v) => !v._deleted)
  const coreOptions = cores.map((c) => ({ value: c.codigo, label: c.descricao, hex: undefined as string | undefined }))
  let ativaIndex = 0

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Variantes — ${modeloCodigo}`}
      >
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />

        <div
          ref={dialogRef}
          className="relative z-10 flex max-h-[90vh] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
          style={{ width: 'min(1400px, 90vw)' }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Variantes — {modeloCodigo} — {modeloNome}
            </h2>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-secondary hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Validation error region */}
          {validationErrors.size > 0 && (
            <div className="px-6 pt-3" aria-live="assertive" role="alert">
              <p className="text-xs text-danger">
                Cor principal obrigatória em todas as variantes
              </p>
            </div>
          )}

          {/* Tabela planilha — scroll horizontal */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-[13px]" role="grid">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border bg-muted/30" role="row">
                  <th className="min-w-[180px] px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Cor Principal
                  </th>
                  <th className="w-16 px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Imagem
                  </th>
                  <th className="min-w-[140px] px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Cor Cabedal
                  </th>
                  <th className="min-w-[140px] px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Cor Sola
                  </th>
                  <th className="min-w-[140px] px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Cor Palmilha
                  </th>
                  <th className="min-w-[140px] px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Cor Facheta
                  </th>
                  <th className="w-12 px-3 py-2.5" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {ativas.length === 0 || (ativas.length === 1 && !ativas[0].id && !ativas[0].corCodigo) ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center">
                      <p className="text-sm text-secondary">Nenhuma variante cadastrada</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={addVariante}
                        disabled={saving}
                        className="mt-3"
                      >
                        Adicionar variante
                      </Button>
                    </td>
                  </tr>
                ) : null}
                {variantes.map((v, index) => {
                  if (v._deleted) return null
                  if (ativas.length === 1 && !ativas[0].id && !ativas[0].corCodigo) return null
                  const isUltima = ativas.length <= 1
                  const currentAtivaIndex = ativaIndex++
                  const hasError = validationErrors.has(index)

                  return (
                    <tr key={v.id ?? `new-${index}`} className="border-b border-border hover:bg-muted/20" role="row">
                      {/* Cor Principal */}
                      <td className="px-3 py-2" role="gridcell">
                        <div className="flex items-center gap-2">
                          <SwatchCor hex={cores.find((c) => c.codigo === v.corCodigo)?.hex ?? undefined} size="md" />
                          <SelectCor
                            value={v.corCodigo}
                            options={coreOptions}
                            loading={coresLoading}
                            placeholder="Selecionar cor"
                            onChange={(val) => updateVariante(index, { corCodigo: val })}
                            width={160}
                            hasError={hasError}
                          />
                        </div>
                      </td>

                      {/* Imagem */}
                      <td className="px-3 py-2" role="gridcell">
                        <UploadImagem
                          imagemUrl={v.imagemUrl}
                          onUpload={(url) => updateVariante(index, { imagemUrl: url })}
                          disabled={saving}
                        />
                      </td>

                      {/* Cores por componente */}
                      <td className="px-3 py-2" role="gridcell">
                        <SelectCor
                          value={v.corCabedal ?? ''}
                          options={[{ value: '', label: '—' }, ...coreOptions]}
                          loading={coresLoading}
                          onChange={(val) => updateVariante(index, { corCabedal: val || null })}
                          width={130}
                        />
                      </td>
                      <td className="px-3 py-2" role="gridcell">
                        <SelectCor
                          value={v.corSola ?? ''}
                          options={[{ value: '', label: '—' }, ...coreOptions]}
                          loading={coresLoading}
                          onChange={(val) => updateVariante(index, { corSola: val || null })}
                          width={130}
                        />
                      </td>
                      <td className="px-3 py-2" role="gridcell">
                        <SelectCor
                          value={v.corPalmilha ?? ''}
                          options={[{ value: '', label: '—' }, ...coreOptions]}
                          loading={coresLoading}
                          onChange={(val) => updateVariante(index, { corPalmilha: val || null })}
                          width={130}
                        />
                      </td>
                      <td className="px-3 py-2" role="gridcell">
                        <SelectCor
                          value={v.corFacheta ?? ''}
                          options={[{ value: '', label: '—' }, ...coreOptions]}
                          loading={coresLoading}
                          onChange={(val) => updateVariante(index, { corFacheta: val || null })}
                          width={130}
                        />
                      </td>

                      {/* Remover */}
                      <td className="px-3 py-2" role="gridcell">
                        <button
                          onClick={() => removeVariante(index)}
                          disabled={isUltima || saving}
                          className={cn(
                            'rounded p-1 transition-colors',
                            isUltima
                              ? 'cursor-not-allowed text-muted-foreground/30'
                              : 'text-secondary hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          )}
                          aria-label={`Remover variante ${currentAtivaIndex + 1}`}
                          title={isUltima ? 'Ao menos 1 variante obrigatória' : `Remover variante ${currentAtivaIndex + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={addVariante}
                disabled={saving}
              >
                Adicionar variante
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  icon={<Save className="h-4 w-4" />}
                  loading={saving}
                  onClick={() => void handleSave()}
                  aria-busy={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ConfirmDialog para fechar com alteracoes */}
      <ConfirmDialog
        open={confirmClose}
        title="Sair sem salvar?"
        description="Você tem alterações não salvas. Deseja sair sem salvar?"
        confirmLabel="Sim, sair"
        variant="warning"
        onConfirm={handleConfirmClose}
        onClose={() => setConfirmClose(false)}
      />
    </>
  )
}

// ── SelectCor inline ──────────────────────────────────────────────────────────

interface SelectCorProps {
  value: string
  options: { value: string; label: string; hex?: string }[]
  loading?: boolean
  placeholder?: string
  onChange: (val: string) => void
  width?: number
  hasError?: boolean
}

function SelectCor({ value, options, loading, placeholder, onChange, width = 140, hasError }: SelectCorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className={cn(
        'rounded-md border bg-background px-2 py-1.5 text-sm text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        'disabled:opacity-60',
        hasError ? 'border-danger' : 'border-border',
      )}
      style={{ width }}
    >
      {placeholder && !value && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
