'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export interface ModeloRow {
  id: string
  codigo: string
  nome: string
  linha?: string | null
  cabedal?: string | null
  sola?: string | null
  palmilha?: string | null
  materialCabedal?: string | null
  materialSola?: string | null
  materialPalmilha?: string | null
  materialFacheta?: string | null
  facheta?: string | null
  totalVariantes: number
}

interface TabelaModelosProps {
  modelos: ModeloRow[]
  loading?: boolean
  onEdit: (modelo: ModeloRow) => void
  onDelete: (modelo: ModeloRow) => void
  onVerVariantes: (modelo: ModeloRow) => void
  onAddFirst?: () => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Column layout (13 cols):
// [0] Código  [1] Nome
// [2] Cab Ref  [3] Cab Material
// [4] Sola Ref  [5] Sola Material
// [6] Palm Ref  [7] Palm Material
// [8] Fach Ref  [9] Fach Material
// [10] Linha  [11] Variantes  [12] Ações
const GROUP_BORDERS = new Set([2, 4, 6, 8, 10])

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 13 }).map((_, i) => (
        <td
          key={i}
          className={cn(
            'px-3 py-3',
            GROUP_BORDERS.has(i) && 'border-l-2 border-border',
          )}
        >
          <div className="h-4 animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  )
}

function Cell({ value }: { value?: string | null }) {
  return value ? (
    <span>{value}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
}

export function TabelaModelos({
  modelos,
  loading,
  onEdit,
  onDelete,
  onVerVariantes,
  onAddFirst,
  page,
  totalPages,
  onPageChange,
}: TabelaModelosProps) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" aria-label="Tabela de modelos" aria-busy={loading}>
          <thead>
            {/* Linha de grupos */}
            <tr className="border-b border-border bg-muted/40">
              <th
                colSpan={2}
                scope="colgroup"
                className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Base
              </th>
              <th
                colSpan={2}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Cabedal
              </th>
              <th
                colSpan={2}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Sola
              </th>
              <th
                colSpan={2}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Palmilha
              </th>
              <th
                colSpan={2}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Facheta
              </th>
              <th
                colSpan={3}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Final
              </th>
            </tr>
            {/* Linha de colunas */}
            <tr className="border-b border-border bg-muted/20">
              <th className="px-3 py-2 text-left font-medium text-secondary">Código</th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Nome</th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">Ref</th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Material</th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">Ref</th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Material</th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">Ref</th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Material</th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">Ref</th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Material</th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">Linha</th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Variantes</th>
              <th className="px-3 py-2 text-right font-medium text-secondary">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && modelos.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-secondary">
                  <p>Nenhum modelo encontrado.</p>
                  {onAddFirst && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={onAddFirst}
                    >
                      Adicionar primeiro modelo
                    </Button>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              modelos.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  {/* BASE */}
                  <td className="px-3 py-3 font-mono text-foreground">{m.codigo}</td>
                  <td className="px-3 py-3 text-foreground">{m.nome}</td>

                  {/* CABEDAL */}
                  <td className="border-l-2 border-border px-3 py-3"><Cell value={m.cabedal} /></td>
                  <td className="px-3 py-3"><Cell value={m.materialCabedal} /></td>

                  {/* SOLA */}
                  <td className="border-l-2 border-border px-3 py-3"><Cell value={m.sola} /></td>
                  <td className="px-3 py-3"><Cell value={m.materialSola} /></td>

                  {/* PALMILHA */}
                  <td className="border-l-2 border-border px-3 py-3"><Cell value={m.palmilha} /></td>
                  <td className="px-3 py-3"><Cell value={m.materialPalmilha} /></td>

                  {/* FACHETA */}
                  <td className="border-l-2 border-border px-3 py-3"><Cell value={m.facheta} /></td>
                  <td className="px-3 py-3"><Cell value={m.materialFacheta} /></td>

                  {/* FINAL */}
                  <td className="border-l-2 border-border px-3 py-3"><Cell value={m.linha} /></td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => onVerVariantes(m)}
                      className="text-primary underline hover:text-primary/80 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={`Ver variantes de ${m.nome}`}
                    >
                      {m.totalVariantes} cor{m.totalVariantes !== 1 ? 'es' : ''}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(m)}
                        className="rounded p-1 text-secondary hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={`Editar modelo ${m.codigo}`}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(m)}
                        className="rounded p-1 text-secondary hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={`Excluir modelo ${m.codigo}`}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            Anterior
          </Button>
          <span className="text-sm text-secondary">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            Próximo
          </Button>
        </div>
      )}
    </div>
  )
}
