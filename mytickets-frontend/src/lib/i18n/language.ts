import { nl } from './nl'

export type Language = 'en' | 'nl'

export const LANGUAGES: Record<Language, string> = { en: 'English', nl: 'Nederlands' }

const STORAGE_KEY = 'mytickets:language'

/** The language chosen on this device, else the browser's: Dutch for Dutch speakers, English otherwise. */
function startingLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'nl') return saved
  } catch {
    /* storage switched off: fall back to the browser */
  }
  const browser = typeof navigator === 'undefined' ? 'en' : navigator.language
  return browser.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

let current: Language = startingLanguage()

export const getLanguage = () => current

/** Switches language for the whole app. The provider redraws everything once this has changed. */
export function setLanguage(language: Language) {
  current = language
  if (typeof document !== 'undefined') document.documentElement.lang = language
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* only remembered for this visit */
  }
}

if (typeof document !== 'undefined') document.documentElement.lang = current

/** For dates and numbers: Belgian conventions in both languages. */
export const locale = () => (current === 'nl' ? 'nl-BE' : 'en-GB')

/**
 * Text in the chosen language. The English text is the key, so a sentence nobody translated yet still
 * reads fine. `{name}` in the text is filled in from `values`.
 *
 *   t('Top up tokens')                     -> "Tokens opladen"
 *   t('Opens {when}', { when: '22:00' })   -> "Opent 22:00"
 */
export function t(english: string, values?: Record<string, string | number>): string {
  const text = current === 'nl' ? (nl[english] ?? english) : english
  if (!values) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
