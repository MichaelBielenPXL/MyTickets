import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Sends the buyer to where they pay: Stripe's own page (another site, so a full page change) or, on a
 * developer's machine, the test checkout inside this app.
 */
export function useGoToCheckout() {
  const navigate = useNavigate()
  return useCallback(
    (checkoutUrl: string) => {
      if (/^https?:\/\//.test(checkoutUrl)) window.location.assign(checkoutUrl)
      else navigate(checkoutUrl)
    },
    [navigate],
  )
}
