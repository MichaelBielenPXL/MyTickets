import { LANGUAGES, type Language, t, useLanguage } from '@/lib/i18n'

/**
 * "🌐 NL ⌄" in the header, as Entry has it. A real select underneath, so phones open their own
 * picker and screen readers know what it is.
 */
export function LanguagePicker() {
  const { language, choose } = useLanguage()

  return (
    <label className="language-picker">
      <GlobeIcon />
      <span aria-hidden="true">{language.toUpperCase()}</span>
      <ChevronIcon />
      <select
        aria-label={t('Language')}
        value={language}
        onChange={(e) => choose(e.target.value as Language)}
      >
        {(Object.keys(LANGUAGES) as Language[]).map((code) => (
          <option key={code} value={code}>
            {LANGUAGES[code]}
          </option>
        ))}
      </select>
    </label>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="language-picker-chevron">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}
