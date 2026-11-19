/** The small part of the Web NFC API we use. Only Chrome on Android has it. */
interface NfcReader {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(
    message: { records: { recordType: 'url'; data: string }[] },
    options?: { signal?: AbortSignal },
  ): Promise<void>
  makeReadOnly(options?: { signal?: AbortSignal }): Promise<void>
  onreading: ((event: { serialNumber: string }) => void) | null
  onreadingerror: (() => void) | null
}

export const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window

function createReader(): NfcReader {
  const Reader = (window as unknown as { NDEFReader: new () => NfcReader }).NDEFReader
  return new Reader()
}

/**
 * Keeps listening for cards until `signal` is aborted.
 * Rejects when the reader cannot start (NFC switched off or not allowed).
 */
export async function listenForCards(
  signal: AbortSignal,
  onCard: (serialNumber: string) => void,
  onUnreadable: () => void,
) {
  const reader = createReader()
  await reader.scan({ signal })
  reader.onreading = (event) => onCard(event.serialNumber)
  reader.onreadingerror = onUnreadable
}

/** Reads one card and stops, for linking a card to an account. */
export function readCardOnce(): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = createReader()
    const stop = new AbortController()
    reader.onreading = (event) => {
      stop.abort()
      resolve(event.serialNumber)
    }
    reader.scan({ signal: stop.signal }).catch(reject)
  })
}

/** Why writing a card stopped: no Web NFC here, the link could not be written, or the chip could not be locked. */
export type WriteProblem = 'unsupported' | 'write-failed' | 'lock-failed'

/**
 * Waits for one card held to the phone, writes `url` to it as its only record and makes the chip read-only,
 * so nobody can change the link later. Resolves with the chip's serial number; rejects with an Error whose
 * message is a {@link WriteProblem}.
 */
export function writeCard(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ serialNumber: string }> {
  if (!('NDEFReader' in window)) return Promise.reject(new Error('unsupported'))
  return new Promise((resolve, reject) => {
    const reader = createReader()
    const stop = new AbortController()
    options.signal?.addEventListener('abort', () => stop.abort())
    reader.onreading = ({ serialNumber }) => {
      reader.onreading = null
      reader
        .write({ records: [{ recordType: 'url', data: url }] })
        .catch(() => Promise.reject(new Error('write-failed')))
        .then(() => reader.makeReadOnly().catch(() => Promise.reject(new Error('lock-failed'))))
        .then(() => resolve({ serialNumber }), reject)
        .finally(() => stop.abort())
    }
    reader.scan({ signal: stop.signal }).catch(() => reject(new Error('unsupported')))
  })
}
