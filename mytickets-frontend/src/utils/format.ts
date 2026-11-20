import { getLanguage, locale, t } from '@/lib/i18n'

const euro = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' })

/** All amounts travel as whole cents; this is the only place they become text. */
export const money = (cents: number) => euro.format(cents / 100)

const wholeTokens = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 })
const partTokens = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Members spend tokens, not euros: one token is worth one euro, so the amount underneath stays in cents.
 * "44 tokens", "12,50 tokens", "1 token".
 */
export const tokens = (cents: number) =>
  `${tokenAmount(cents)} ${Math.abs(cents) === 100 ? 'token' : 'tokens'}`

/** Just the number of tokens, for places that write the word themselves: "44", "12,50". */
export const tokenAmount = (cents: number) =>
  (cents % 100 === 0 ? wholeTokens : partTokens).format(cents / 100)

/** A member's balance, written as tokens are everywhere members see them: "60 tokens", "12,50 tokens". */
export const tokenBalance = (cents: number) => tokens(cents)

/** Tokens with the token sign in front, as € goes in front of euros: "T 44", "T 12,50". */
export const tokenPrice = (cents: number) => `T ${tokenAmount(cents)}`

/** "+40 tokens" coming in, "−12,50 tokens" going out. */
export const signedTokens = (cents: number) => `${cents >= 0 ? '+' : '−'}${tokens(Math.abs(cents))}`

/** Date formats in the chosen language, made once per language. */
const formats = new Map<string, Intl.DateTimeFormat>()
function format(name: string, options: Intl.DateTimeFormatOptions) {
  const key = `${getLanguage()}:${name}`
  let found = formats.get(key)
  if (!found) {
    found = new Intl.DateTimeFormat(locale(), { ...options, timeZone: 'Europe/Brussels' })
    formats.set(key, found)
  }
  return found
}

/** "18" and "Nov" ("nov.") for the date block on an event, on Belgian time. */
export const dayNumber = (iso: string) => format('day', { day: 'numeric' }).format(new Date(iso))
export const monthShort = (iso: string) => format('month', { month: 'short' }).format(new Date(iso))

/** "12,50" or "12.5" -> 1250. Returns null when it is not an amount. */
export function parseEuro(text: string): number | null {
  const cleaned = text.trim().replace('€', '').replace(',', '.').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/** Like parseEuro, for forms: throws a message the person can act on. */
export function requireEuro(text: string): number {
  const cents = parseEuro(text)
  if (cents === null) throw new Error(t('Enter prices like 12,50.'))
  return cents
}

export function requireWholeNumber(text: string, what: string): number {
  if (!/^\d+$/.test(text.trim())) throw new Error(t('Enter a whole number for {what}.', { what }))
  return Number(text)
}

/** A price ready to edit in a form, written the European way: 2,50. */
export const euroInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

/**
 * Dates and times are written the European way (30/06/2027, 22:00) and always on Belgian time, so a
 * party at 22:00 says 22:00 whatever the visitor's computer is set to.
 */
/** "30/06/2027" */
export const dateOnly = (iso: string) =>
  format('date', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))

/** "22:14" */
export const timeOnly = (iso: string) => timeFormatter().format(new Date(iso))
const timeFormatter = () => format('time', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "Sat 05/12/2026 22:00" */
export const dateTime = (iso: string) => {
  const moment = new Date(iso)
  const weekday = format('weekday', { weekday: 'short' }).format(moment)
  return `${weekday} ${dateOnly(iso)} ${timeOnly(iso)}`
}

/** A calendar day as chosen, without any time zone: "2027-06-30" -> "30/06/2027". */
export const calendarDay = (isoDay: string) => isoDay.split('-').reverse().join('/')

/**
 * The last day something is valid when it stops at the given moment. A membership that ends on 30/06
 * stops at midnight, which is already 01/07; people expect to read "until 30/06".
 */
export const lastValidDay = (endIso: string) => dateOnly(new Date(Date.parse(endIso) - 1000).toISOString())

/** ISO time -> value for an <input type="datetime-local"> in the visitor's own time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null)

export const errorText = (error: unknown) =>
  error instanceof Error ? t(error.message) : t('Something went wrong.')
