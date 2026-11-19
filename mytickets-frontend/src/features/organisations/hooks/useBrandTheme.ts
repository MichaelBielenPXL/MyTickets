import { useEffect } from 'react'

import { usePublicOrganisation } from '../api/organisations'
import { brandStyle } from '../utils/brand'

/**
 * Paints the whole app in the organisation's colour while you are inside it: its buttons, the
 * selected tab. The colour is set on the page root, so the header and tab bar pick it up as well.
 */
export function useBrandTheme(slug: string | null) {
  const color = usePublicOrganisation(slug ?? '', Boolean(slug)).data?.brandColor

  useEffect(() => {
    if (!slug) return
    const root = document.documentElement
    const variables = Object.entries(brandStyle(color)) as [string, string][]
    for (const [name, value] of variables) root.style.setProperty(name, value)
    root.dataset.orgBrand = ''
    return () => {
      for (const [name] of variables) root.style.removeProperty(name)
      delete root.dataset.orgBrand
    }
  }, [slug, color])
}
