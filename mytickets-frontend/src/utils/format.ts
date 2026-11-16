const euro = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' })

/** All amounts travel as whole cents; this is the only place they become text. */
export const money = (cents: number) => euro.format(cents / 100)

/** "12,50" or "12.5" -> 1250. Returns null when it is not an amount. */
export function parseEuro(text: string): number | null {
  const cleaned = text.trim().replace('€', '').replace(',', '.').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/** Like parseEuro, for forms: throws a message the person can act on. */
export function requireEuro(text: string): number {
  const cents = parseEuro(text)
  if (cents === null) throw new Error('Enter prices like 12,50.')
  return cents
}

export function requireWholeNumber(text: string, what: string): number {
  if (!/^\d+$/.test(text.trim())) throw new Error(`Enter a whole number for ${what}.`)
  return Number(text)
}

export const euroInput = (cents: number) => (cents / 100).toFixed(2)

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** ISO time -> value for an <input type="datetime-local"> in the visitor's own time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null)

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.'
