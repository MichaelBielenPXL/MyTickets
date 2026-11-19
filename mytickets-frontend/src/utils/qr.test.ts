import { cardCodeFromQr, cardIdFromQr, readStaffQr } from './qr'

describe('cardIdFromQr', () => {
  it('reads a plain number, a query value, or the end of a URL', () => {
    expect(cardIdFromQr(' 04A2B91C5E8F80 ')).toBe('04A2B91C5E8F80')
    expect(cardIdFromQr('https://cards.example/c?uid=04A2B91C')).toBe('04A2B91C')
    expect(cardIdFromQr('https://cards.example/c/04A2B91C')).toBe('04A2B91C')
  })

  it('leaves a member code as it is', () => {
    expect(cardIdFromQr('MTABCD2345WXYZ')).toBe('MTABCD2345WXYZ')
  })
})

describe('readStaffQr', () => {
  it('sends tickets and member codes as a code', () => {
    expect(readStaffQr('0123456789ABCDEF01234567')).toEqual({ code: '0123456789ABCDEF01234567' })
    expect(readStaffQr('MTABCD2345WXYZ')).toEqual({ code: 'MTABCD2345WXYZ' })
    expect(readStaffQr('MT-ABCD-2345-WXYZ')).toEqual({ code: 'MT-ABCD-2345-WXYZ' })
  })

  it("sends an issued card's link as that card", () => {
    expect(readStaffQr('https://tickets.test/c/ABCDEFGHJK')).toEqual({ cardUid: 'ABCDEFGHJK' })
  })

  it('sends a printed card QR as a tap of that card', () => {
    expect(readStaffQr('04A2B91C5E8F80')).toEqual({ cardUid: '04A2B91C5E8F80' })
    expect(readStaffQr('https://cards.example/c?uid=04A2B91C')).toEqual({ cardUid: '04A2B91C' })
  })
})

describe('cardCodeFromQr', () => {
  it("reads the code from a card's link", () => {
    expect(cardCodeFromQr('https://tickets.test/c/abcdefghjk')).toBe('ABCDEFGHJK')
    expect(cardCodeFromQr('ABCDEFGHJK')).toBe('ABCDEFGHJK')
  })

  it('is null for anything else', () => {
    expect(cardCodeFromQr('https://example.com/hello')).toBeNull()
    expect(cardCodeFromQr('04A2B91C5E8F80')).toBeNull()
    expect(cardCodeFromQr('MTABCD2345WXYZ')).toBeNull()
  })
})
