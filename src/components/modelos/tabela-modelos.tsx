'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export interface ModeloRow {
  id: string
  codigo: string
  nome: string
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

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td
          key={i}
          className={cn(
            'px-3 py-3',
            // Borders between groups
            i === 2 && 'border-l-2 border-border',
            i === 3 && 'border-l-2 border-border',
            i === 4 && 'border-l-2 border-border',
            i === 5 && 'border-l-2 border-border',
            i === 7 && 'border-l-2 border-border',
          )}
        >
          <div className="h-4 animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
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
              {/* BASE */}
              <th
                colSpan={2}
                scope="colgroup"
                className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Base
              </th>
              {/* CABEDAL */}
              <th
                colSpan={1}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Cabedal
              </th>
              {/* SOLA */}
              <th
                colSpan={1}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Sola
              </th>
              {/* PALMILHA */}
              <th
                colSpan={1}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Palmilha
              </th>
              {/* FACHETA */}
              <th
                colSpan={2}
                scope="colgroup"
                className="border-l-2 border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-secondary"
              >
                Facheta
              </th>
              {/* FINAL */}
              <th
                colSpan={2}
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
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">
                Material
              </th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">
                Material
              </th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">
                Material
              </th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">
                Material
              </th>
              <th className="px-3 py-2 text-left font-medium text-secondary">Descrição</th>
              <th className="border-l-2 border-border px-3 py-2 text-left font-medium text-secondary">
                Variantes
              </th>
              <th className="px-3 py-2 text-right font-medium text-secondary">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && modelos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-secondary">
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
                  <td className="border-l-2 border-border px-3 py-3">
                    {m.materialCabedal ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* SOLA */}
                  <td className="border-l-2 border-border px-3 py-3">
                    {m.materialSola ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* PALMILHA */}
                  <td className="border-l-2 border-border px-3 py-3">
                    {m.materialPalmilha ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* FACHETA */}
                  <td className="border-l-2 border-border px-3 py-3">
                    {m.materialFacheta ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {m.facheta ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* FINAL */}
                  <td className="border-l-2 border-border px-3 py-3">
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
