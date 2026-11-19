/** A card QR can contain the raw serial number, a URL query value, or a URL ending in the serial. */
export function cardIdFromQr(payload: string): string {
  const value = payload.trim()
  try {
    const url = new URL(value)
    for (const key of ['uid', 'cardUid', 'card_id', 'card', 'serial', 'serialNumber']) {
      const id = url.searchParams.get(key)
      if (id) return id.trim()
    }
    const lastPart = url.pathname.split('/').filter(Boolean).at(-1)
    if (lastPart) return decodeURIComponent(lastPart)
  } catch {
    // A plain card serial number is also a valid QR payload.
  }
  return value
}

const CARD_CODE = /^[A-HJ-NP-Z2-9]{10}$/

/** The code from an issued card's link or printed QR ("https://…/c/ABCDEFGHJK"), or null when it isn't one. */
export function cardCodeFromQr(payload: string): string | null {
  let value = payload.trim()
  try {
    value = new URL(value).pathname.split('/').filter(Boolean).at(-1) ?? ''
  } catch {
    // Not a link: maybe the bare code.
  }
  const code = value.replace(/[\s-]/g, '').toUpperCase()
  return CARD_CODE.test(code) ? code : null
}

// Ticket codes are 12 random bytes in hex; card numbers are at most 20 hex digits, so they never clash.
const TICKET_CODE = /^[0-9A-F]{24}$/i
// The member's QR code (also in Apple and Google Wallet): "MT" and 12 letters or digits.
const MEMBER_CODE = /^MT[-\s]?[A-Z0-9-\s]{12,}$/i

/**
 * What a QR code scanned by staff points at: a ticket or a member code (both sent as a code), or the
 * number printed on a card (sent like a tap of that card).
 */
export function readStaffQr(payload: string): { code: string } | { cardUid: string } {
  const value = payload.trim()
  if (TICKET_CODE.test(value) || MEMBER_CODE.test(value)) return { code: value }
  return { cardUid: cardIdFromQr(value) }
}
