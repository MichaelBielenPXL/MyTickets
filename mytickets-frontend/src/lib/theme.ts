import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Also read by the small script in index.html, which sets the theme before the page first paints. */
const STORAGE_KEY = 'mytickets:theme'
const darkQuery = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** The theme chosen on this device with the switch, or null to follow the device's own setting. */
function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

const deviceTheme = (): Theme => (darkQuery()?.matches ? 'dark' : 'light')

/** Puts the theme on <html> (the CSS and Tailwind's dark: read it there) and colours the browser's own bar. */
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7')
}

/** Light or dark, and the switch between them. Until switched, it follows the device and its changes. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? deviceTheme())

  useEffect(() => apply(theme), [theme])

  useEffect(() => {
    const query = darkQuery()
    if (!query) return
    const changed = () => {
      if (!savedTheme()) setTheme(deviceTheme())
    }
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  }, [])

  const toggle = useCallback(() => {
    setTheme((now) => {
      const next: Theme = now === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* only for this visit */
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
