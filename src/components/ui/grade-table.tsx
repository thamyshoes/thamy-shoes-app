import { cn } from '@/lib/cn'
import type { GradeRow } from '@/types'

interface GradeTableProps {
  grades: GradeRow[]
  showTotal?: boolean
}

export function GradeTable({ grades, showTotal = true }: GradeTableProps) {
  if (grades.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-secondary">
        Nenhuma grade disponível (itens pendentes de resolução)
      </p>
    )
  }

  // Collect all unique tamanhos across all grades, sorted numerically
  const allTamanhos = Array.from(
    new Set(grades.flatMap((g) => Object.keys(g.tamanhos).map(Number))),
  ).sort((a, b) => a - b)

  // Column totals
  const colTotals = allTamanhos.reduce<Record<number, number>>((acc, tam) => {
    acc[tam] = grades.reduce((sum, g) => sum + (g.tamanhos[String(tam)] ?? 0), 0)
    return acc
  }, {})

  const grandTotal = grades.reduce((sum, g) => sum + g.totalPares, 0)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-secondary">Ref / Cor</th>
            {allTamanhos.map((tam) => (
              <th
                key={tam}
                className="min-w-[3rem] px-2 py-2 text-right font-semibold text-secondary font-mono"
              >
                {tam}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-semibold text-secondary">Total</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((grade, rowIdx) => (
            <tr
              key={`${grade.modelo}-${grade.cor}`}
              className={cn('border-t border-border', rowIdx % 2 === 1 && 'bg-muted/40')}
            >
              <td className="px-4 py-2 font-medium text-foreground">
                <span className="font-mono text-xs">{grade.modelo}</span>
                <span className="mx-1 text-secondary">/</span>
                <span className="text-xs text-secondary">{grade.corDescricao}</span>
              </td>
              {allTamanhos.map((tam) => {
                const qty = grade.tamanhos[String(tam)] ?? 0
                return (
                  <td
                    key={tam}
                    className={cn(
                      'px-2 py-2 text-right font-mono text-xs',
                      qty === 0 ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {qty === 0 ? '—' : qty}
                  </td>
                )
              })}
              <td className="px-4 py-2 text-right font-mono text-xs font-bold text-foreground">
                {grade.totalPares}
              </td>
            </tr>
          ))}
        </tbody>
        {showTotal && grades.length > 1 && (
          <tfoot className="border-t-2 border-border bg-surface">
            <tr>
              <td className="px-4 py-2 text-xs font-semibold text-secondary">Total</td>
              {allTamanhos.map((tam) => (
                <td
                  key={tam}
                  className="px-2 py-2 text-right font-mono text-xs font-bold text-foreground"
                >
                  {colTotals[tam] === 0 ? '—' : colTotals[tam]}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-mono text-xs font-bold text-foreground">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
