import { writeCard } from './nfc'

type Reading = (event: { serialNumber: string }) => void

/** A stand-in for Chrome's NDEFReader: a card is "held to the phone" when `tap` is called. */
function fakeReader({ lockFails = false } = {}) {
  const calls: string[] = []
  let reading: Reading | null = null
  class FakeNdefReader {
    set onreading(handler: Reading | null) {
      reading = handler
    }
    onreadingerror = null
    scan() {
      calls.push('scan')
      return Promise.resolve()
    }
    write(message: { records: { recordType: string; data: string }[] }) {
      calls.push(`write ${message.records[0].recordType} ${message.records[0].data}`)
      return Promise.resolve()
    }
    makeReadOnly() {
      calls.push('lock')
      return lockFails ? Promise.reject(new Error('nope')) : Promise.resolve()
    }
  }
  vi.stubGlobal('NDEFReader', FakeNdefReader)
  return { calls, tap: (serialNumber: string) => reading?.({ serialNumber }) }
}

afterEach(() => vi.unstubAllGlobals())

describe('writeCard', () => {
  it('waits for a card, writes the link and locks the chip', async () => {
    const reader = fakeReader()
    const written = writeCard('https://tickets.test/c/ABCDEFGHJK')
    await Promise.resolve()
    reader.tap('04:a2:b9:1c')

    await expect(written).resolves.toEqual({ serialNumber: '04:a2:b9:1c' })
    expect(reader.calls).toEqual(['scan', 'write url https://tickets.test/c/ABCDEFGHJK', 'lock'])
  })

  it('says so when the chip could not be locked', async () => {
    const reader = fakeReader({ lockFails: true })
    const written = writeCard('https://tickets.test/c/ABCDEFGHJK')
    await Promise.resolve()
    reader.tap('04:a2:b9:1c')

    await expect(written).rejects.toThrow('lock-failed')
  })
})
