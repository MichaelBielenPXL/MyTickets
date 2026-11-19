/** The card someone tapped before signing in or joining, so they come back to it afterwards. */
export const PENDING_CARD_KEY = 'mytickets.pendingCard'

export function rememberPendingCard(code: string) {
  try {
    sessionStorage.setItem(PENDING_CARD_KEY, code)
  } catch {
    // Private mode: they tap the card again after signing in.
  }
}

/** The remembered card, forgotten as it is handed back. */
export function takePendingCard(): string | null {
  try {
    const code = sessionStorage.getItem(PENDING_CARD_KEY)
    sessionStorage.removeItem(PENDING_CARD_KEY)
    return code
  } catch {
    return null
  }
}
