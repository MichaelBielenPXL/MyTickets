/** One label and value on a line, as in the overview's cards. */
export function DataRow({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={indent ? 'admin-data-row indent' : 'admin-data-row'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
