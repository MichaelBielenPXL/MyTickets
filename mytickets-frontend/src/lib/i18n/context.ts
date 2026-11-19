import { createContext, useContext } from 'react'

import type { Language } from './language'

type LanguageContextValue = { language: Language; choose: (language: Language) => void }

export const LanguageContext = createContext<LanguageContextValue>({ language: 'en', choose: () => {} })

/** The chosen language, and the way to change it. */
export const useLanguage = () => useContext(LanguageContext)
