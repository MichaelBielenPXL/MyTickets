/** The small part of the Web NFC API we use. Only Chrome on Android has it. */
interface NfcReader {
  scan(options?: { signal?: AbortSignal }): Promise<void>
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
