'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

interface Variante {
  cor: string
  corDescricao: string
  tamanhos: string[]
  totalSkus: number
  nome: string
  imagemUrl: string | null
  jaCadastrada: boolean
  fonte?: 'local' | 'bling' | 'ambas'
}

interface SearchResult {
  modelo: string
  modeloExiste: boolean
  total: number
  fonte: string
  blingTruncated?: boolean
  warnings?: string[]
  variantes: Variante[]
}

interface ModalImportarModeloProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function ModalImportarModelo({ open, onClose, onImported }: ModalImportarModeloProps) {
  const [codigo, setCodigo] = useState('')
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCodigo('')
    setResult(null)
    setSelected(new Set())
    setError(null)
    setSearching(false)
    setImporting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSearch() {
    const trimmed = codigo.trim()
    if (trimmed.length < 3) {
      setError('Digite pelo menos 3 caracteres')
      return
    }

    setSearching(true)
    setError(null)
    setResult(null)
    setSelected(new Set())

    try {
      const res = await fetch(`/api/configuracoes/modelos/importar-modelo?codigo=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Erro ${res.status}`)
      }

      const data = await res.json() as SearchResult
      setResult(data)

      if (data.variantes.length === 0) {
        setError(`Nenhum produto encontrado para o modelo "${trimmed}"`)
      } else {
        // Pre-selecionar variantes que ainda não estão cadastradas
        const novas = new Set(
          data.variantes.filter((v) => !v.jaCadastrada).map((v) => v.cor),
        )
        setSelected(novas)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar')
    } finally {
      setSearching(false)
    }
  }

  function toggleCor(cor: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cor)) next.delete(cor)
      else next.add(cor)
      return next
    })
  }

  function toggleAll() {
    if (!result) return
    const selectable = result.variantes.filter((v) => !v.jaCadastrada)
    if (selected.size === selectable.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectable.map((v) => v.cor)))
    }
  }

  async function handleImport() {
    if (!result || selected.size === 0) return

    setImporting(true)
    try {
      // Enviar cores com imagemUrl para persistência
      const coresPayload = result.variantes
        .filter((v) => selected.has(v.cor))
        .map((v) => ({ cor: v.cor, imagemUrl: v.imagemUrl }))

      const res = await fetch('/api/configuracoes/modelos/importar-modelo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: result.modelo,
          nome: result.variantes[0]?.nome ?? `Modelo ${result.modelo}`,
          cores: coresPayload,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Erro ${res.status}`)
      }

      const data = await res.json()
      const partes: string[] = []
      if (data.variantesCriadas > 0) partes.push(`${data.variantesCriadas} variante(s) criada(s)`)
      if (data.itensVinculados > 0) partes.push(`${data.itensVinculados} item(ns) vinculado(s)`)
      toast.success(
        `Modelo ${data.modelo} importado${partes.length > 0 ? ` — ${partes.join(', ')}` : ''}`,
      )
      handleClose()
      onImported()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar')
    } finally {
      setImporting(false)
    }
  }

  const selectableCount = result?.variantes.filter((v) => !v.jaCadastrada).length ?? 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar Modelo do Bling"
      size="lg"
      footer={
        result && result.variantes.length > 0 ? (
          <div className="flex justify-between items-center">
            <span className="text-sm text-secondary">
              {selected.size} de {selectableCount} variante(s) selecionada(s)
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={selected.size === 0}
              >
                Importar {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* Busca */}
      <div className="flex gap-2">
        <input
          data-autofocus
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !searching && handleSearch()}
          placeholder="Código do modelo (ex: 3073)"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button onClick={handleSearch} loading={searching} icon={<Search className="h-4 w-4" />}>
          Buscar
        </Button>
      </div>

      {/* Warnings */}
      {result?.warnings?.map((w, i) => (
        <p key={i} className="mt-2 text-xs text-warning bg-warning/10 rounded px-2 py-1">
          {w}
        </p>
      ))}

      {/* Erro */}
      {error && (
        <p className="mt-3 text-sm text-danger">{error}</p>
      )}

      {/* Resultado */}
      {result && result.variantes.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-foreground">
              Modelo {result.modelo}
              {result.modeloExiste && (
                <span className="ml-2 text-xs text-secondary">(já cadastrado)</span>
              )}
              <span className="ml-2 text-xs text-secondary">
                — {result.total} SKU(s), fonte: {result.fonte}
              </span>
            </h3>
            {selectableCount > 1 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {selected.size === selectableCount ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>

          {result.blingTruncated && (
            <p className="mb-2 text-xs text-warning bg-warning/10 rounded px-2 py-1">
              A busca no Bling retornou muitos resultados e pode estar incompleta.
              Se faltarem variantes, tente usar o sync "Bling (tudo)".
            </p>
          )}

          <div className="space-y-1 max-h-[40vh] overflow-y-auto">
            {result.variantes.map((v) => (
              <label
                key={v.cor}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  v.jaCadastrada
                    ? 'border-border bg-muted/50 opacity-60 cursor-default'
                    : selected.has(v.cor)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={v.jaCadastrada || selected.has(v.cor)}
                  disabled={v.jaCadastrada}
                  onChange={() => !v.jaCadastrada && toggleCor(v.cor)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                {v.imagemUrl && (
                  <img
                    src={v.imagemUrl}
                    alt={`Cor ${v.corDescricao}`}
                    className="h-8 w-8 rounded object-cover border border-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Cor {v.corDescricao}
                    </span>
                    <span className="text-xs text-secondary">({v.cor})</span>
                    {v.jaCadastrada && (
                      <span className="text-xs text-success font-medium">já cadastrada</span>
                    )}
                  </div>
                  <div className="text-xs text-secondary mt-0.5">
                    {v.totalSkus} SKU(s) — Tamanhos: {v.tamanhos.join(', ')}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {searching && (
        <div className="mt-4 flex items-center gap-2 text-sm text-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Buscando no banco local e no Bling...
        </div>
      )}
    </Modal>
  )
}
