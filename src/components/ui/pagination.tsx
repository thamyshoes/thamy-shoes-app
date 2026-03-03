interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs text-secondary">
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-3 py-1 text-xs text-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded px-3 py-1 text-xs text-secondary hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Próximo
        </button>
      </div>
    </div>
  )
}
