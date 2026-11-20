import { useState } from 'react'

import { t } from '@/lib/i18n'
import { nfcSupported, writeCard } from '@/lib/nfc'
import { cardCodeFromQr } from '@/utils/qr'

import { useCardWriting, useCreateBlankCard, useReportCardWritten, useSetCardBlocked } from '../api/admin'
import type { AdminCard } from '../types'

export type WriterStep =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'holding'; card: AdminCard }
  /** Written and locked, but the server didn't hear which chip: only that is sent again. */
  | { kind: 'unreported'; card: AdminCard; uid: string }
  | { kind: 'done'; card: AdminCard }
  /** A blocked card nobody has, scanned because it turned up: offered back as a new card. */
  | { kind: 'reusable'; card: AdminCard }
  | { kind: 'reused'; card: AdminCard }

/**
 * Writing cards on an Android phone, shared by the write panel and each card in the list: one card at a time,
 * whichever way it was picked (its printed QR, a blank card, or its own Write button).
 */
export function useCardWriter(slug: string) {
  const writing = useCardWriting(slug).data
  const createBlank = useCreateBlankCard(slug)
  const report = useReportCardWritten(slug)
  const unblock = useSetCardBlocked(slug)
  const [step, setStep] = useState<WriterStep>({ kind: 'idle' })
  const [problem, setProblem] = useState('')

  async function write(card: AdminCard) {
    if (!card.url) return
    setProblem('')
    setStep({ kind: 'holding', card })
    try {
      const { serialNumber } = await writeCard(card.url, {})
      sendChip(card, serialNumber)
    } catch (error) {
      setStep({ kind: 'idle' })
      setProblem(writeProblem(error))
    }
  }

  function sendChip(card: AdminCard, uid: string) {
    report.mutate(
      { id: card.id, uid },
      {
        onSuccess: () => setStep({ kind: 'done', card }),
        onError: () => setStep({ kind: 'unreported', card, uid }),
      },
    )
  }

  function scanned(payload: string, cards: AdminCard[]) {
    const code = cardCodeFromQr(payload)
    const card = cards.find((c) => c.code === code)
    if (!card) {
      setStep({ kind: 'idle' })
      return setProblem(t("This QR code isn't one of your cards."))
    }
    if (card.uid && card.blocked && !card.linkedTo) return setStep({ kind: 'reusable', card })
    if (card.uid) {
      setStep({ kind: 'idle' })
      return setProblem(t('Card {number} is already written.', { number: card.number }))
    }
    void write(card)
  }

  function writeBlank() {
    setProblem('')
    createBlank.mutate(undefined, { onSuccess: (card) => void write(card) })
  }

  function reuse(card: AdminCard) {
    unblock.mutate({ id: card.id, blocked: false }, { onSuccess: () => setStep({ kind: 'reused', card }) })
  }

  function startScanning() {
    setProblem('')
    setStep({ kind: 'scanning' })
  }

  function cameraFailed() {
    setStep({ kind: 'idle' })
    setProblem(t('The camera could not start. Allow camera access for this site.'))
  }

  return {
    /** Writing works here: Chrome on Android, and the site's real address is set. */
    canWrite: nfcSupported && writing?.ready === true,
    writing,
    step,
    problem,
    error: createBlank.error ?? unblock.error,
    busy: step.kind === 'holding' || createBlank.isPending || report.isPending || unblock.isPending,
    reporting: report.isPending,
    write,
    sendChip,
    scanned,
    writeBlank,
    reuse,
    startScanning,
    stopScanning: () => setStep({ kind: 'idle' }),
    cameraFailed,
  }
}

export type CardWriter = ReturnType<typeof useCardWriter>

function writeProblem(error: unknown) {
  switch (error instanceof Error ? error.message : '') {
    case 'lock-failed':
      return t(
        'The link is written, but the chip could not be locked. Put this card aside and use another one.',
      )
    case 'unsupported':
      return t('The phone could not start writing. Turn on NFC and allow it for this site.')
    default:
      return t('The card could not be written. Hold it still against the phone and try again.')
  }
}
