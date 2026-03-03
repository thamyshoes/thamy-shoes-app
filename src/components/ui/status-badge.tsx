import { cn } from '@/lib/cn'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const STATUS_MAP: Record<string, Variant> = {
  IMPORTADO: 'info',
  DISPONIVEL: 'info',
  FICHAS_GERADAS: 'success',
  PENDENTE_AJUSTE: 'warning',
  RESOLVIDO: 'success',
  PENDENTE: 'warning',
  CONECTADO: 'success',
  EXPIRADO: 'danger',
  DESCONECTADO: 'default',
  CABEDAL: 'info',
  PALMILHA: 'success',
  SOLA: 'accent',
}

const STATUS_LABEL: Record<string, string> = {
  IMPORTADO: 'Importado',
  DISPONIVEL: 'Disponível',
  FICHAS_GERADAS: 'Fichas Geradas',
  PENDENTE_AJUSTE: 'Pendente Ajuste',
  RESOLVIDO: 'Resolvido',
  PENDENTE: 'Pendente',
  CONECTADO: 'Conectado',
  EXPIRADO: 'Expirado',
  DESCONECTADO: 'Desconectado',
  CABEDAL: 'Cabedal',
  PALMILHA: 'Palmilha',
  SOLA: 'Sola',
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  accent: 'bg-accent/10 text-accent',
}

interface StatusBadgeProps {
  status: string
  variant?: Variant
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, variant, size = 'md' }: StatusBadgeProps) {
  const resolvedVariant = variant ?? STATUS_MAP[status] ?? 'default'
  const label = STATUS_LABEL[status] ?? status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        variantClasses[resolvedVariant],
      )}
    >
      {label}
    </span>
  )
}
