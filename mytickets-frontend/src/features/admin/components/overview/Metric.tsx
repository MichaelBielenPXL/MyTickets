/** One headline figure in a card: what it is, the number, and a line about it. */
export function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <dl className="admin-card overview-metric">
      <dt>{label}</dt>
      <dd className="admin-kpi-number">{value}</dd>
      {note && <dd className="admin-card-note">{note}</dd>}
    </dl>
  )
}
