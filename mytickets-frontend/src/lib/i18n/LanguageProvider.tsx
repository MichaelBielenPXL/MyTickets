import { type ReactNode, useCallback, useMemo, useState } from 'react'

import { LanguageContext } from './context'
import { type Language, getLanguage, setLanguage } from './language'

/**
 * Holds the chosen language. Changing it redraws the whole app (the `key`), so every text, date and
 * number shows in the new language, also the ones worked out outside components.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(getLanguage)

  const choose = useCallback((next: Language) => {
    setLanguage(next)
    setState(next)
  }, [])

  const value = useMemo(() => ({ language, choose }), [language, choose])
  return (
    <LanguageContext.Provider value={value}>
      <LanguageRoot key={language}>{children}</LanguageRoot>
    </LanguageContext.Provider>
  )
}

function LanguageRoot({ children }: { children: ReactNode }) {
  return children
}
