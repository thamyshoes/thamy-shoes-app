'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EmptyState } from './empty-state'
import { TableSkeleton } from './loading-skeleton'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  mono?: boolean
}

type SortDirection = 'asc' | 'desc'

interface SortState {
  key: string
  direction: SortDirection
}

interface DataTableProps<T extends { id?: string }> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  emptyMessage?: string
  emptyAction?: { label: string; onClick: () => void }
  onRowClick?: (item: T) => void
  pagination?: { page: number; pageSize: number; total: number }
  onPageChange?: (page: number) => void
  className?: string
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }

function SortIcon({ column, sort }: { column: string; sort: SortState | null }) {
  if (!sort || sort.key !== column) {
    return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
  }
  return sort.direction === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  )
}

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado',
  emptyAction,
  onRowClick,
  pagination,
  onPageChange,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null)

  function handleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  const sortedData = useMemo(() => {
    if (!sort) return data
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort.key]
      const bVal = (b as Record<string, unknown>)[sort.key]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [data, sort])

  if (loading) {
    return <TableSkeleton rows={5} cols={columns.length} />
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} action={emptyAction} />
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 font-semibold text-secondary',
                    alignClass[col.align ?? 'left'],
                    col.sortable && 'cursor-pointer select-none hover:text-foreground',
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.header}
                  {col.sortable && <SortIcon column={col.key} sort={sort} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, rowIdx) => (
              <tr
                key={(item as Record<string, unknown>).id as string ?? rowIdx}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'border-t border-border transition-colors',
                  rowIdx % 2 === 1 && 'bg-muted/50',
                  onRowClick && 'cursor-pointer hover:bg-muted',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-foreground',
                      alignClass[col.align ?? 'left'],
                      col.mono && 'font-mono text-xs',
                    )}
                  >
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-secondary">
            Página {pagination.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded px-3 py-1 text-xs text-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="rounded px-3 py-1 text-xs text-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
