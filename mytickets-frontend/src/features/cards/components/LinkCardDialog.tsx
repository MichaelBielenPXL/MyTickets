import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ConfirmDialog, ErrorNote } from '@/components'
import { t } from '@/lib/i18n'

import { useCardState, useClaimCard } from '../api/cards'

type LinkCardDialogProps = {
  slug: string
  /** The code from the card's link or printed QR. */
  code: string
  /** Called when the question is answered: linked, put off, or not possible. */
  onDone: () => void
}

/**
 * "Link card 0042 to your wallet?", asked after someone taps a card nobody has claimed yet (or scans its QR).
 * Someone without a membership is sent to join first; the card is remembered so they come back to it.
 */
export function LinkCardDialog({ slug, code, onDone }: LinkCardDialogProps) {
  const navigate = useNavigate()
  const card = useCardState(slug, code).data
  const claim = useClaimCard(slug)
  const [linked, setLinked] = useState<string | null>(null)

  if (linked) {
    return (
      <p className="panel card-linked" role="status">
        {t('Card {number} is linked to your wallet.', { number: linked })}
      </p>
    )
  }
  if (claim.error) return <ErrorNote error={claim.error} />
  if (!card || card.state !== 'free') return null

  return (
    <ConfirmDialog
      open
      title={t('Link card {number} to your wallet?', { number: card.number })}
      message={
        card.member
          ? t('Then this card pays with your tokens at the bar, and tapping it opens your wallet.')
          : t('Only members can link a card. Choose a membership first, then tap the card again.')
      }
      confirmLabel={card.member ? t('Link card') : t('Become a member')}
      cancelLabel={t('Not now')}
      busy={claim.isPending}
      onCancel={onDone}
      onConfirm={() =>
        card.member
          ? claim.mutate(code, { onSuccess: (result) => setLinked(result.number) })
          : navigate(`/${slug}/join`)
      }
    />
  )
}
