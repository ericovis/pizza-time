export interface StatusBadgeProps {
  /** Order.status — drive logic off this. */
  status: string
  /** Order.status_label — what the user reads. Defaults to `status`. */
  label?: string
  className?: string
}

/** The small pill on an order row: outlined once delivered, magenta while live. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const done = status === 'Delivered'
  const classes = ['badge-status', done ? 'badge-status--done' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <span className={classes}>{label ?? status}</span>
}

export default StatusBadge
