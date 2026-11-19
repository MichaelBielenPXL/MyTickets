import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'
import { ApiError } from '@/lib/api-client'
import { t } from '@/lib/i18n'

import { useCardOrganisation, useCardState } from '../api/cards'
import { rememberPendingCard, takePendingCard } from '../utils/pending-card'

const UNAUTHORISED = 401

/**
 * Where a phone lands when a card is held to it (the link written on the chip, or its printed QR): the
 * owner's wallet, the question whether to link a free card, or why that can't be done.
 */
export function CardLinkPage() {
  const { code = '' } = useParams()
  const organisation = useCardOrganisation(code)
  const slug = organisation.data?.slug ?? ''
  const card = useCardState(slug, code, Boolean(slug))
  const signedOut = card.error instanceof ApiError && card.error.status === UNAUTHORISED

  const reached = Boolean(card.data)
  useEffect(() => {
    // Remembered while they sign in or join; once the card is reached it has done its job.
    if (signedOut) rememberPendingCard(code)
    else if (reached) takePendingCard()
  }, [signedOut, reached, code])

  if (organisation.error) return <Message error={organisation.error} />
  if (signedOut) return <Navigate to={`/${slug}/login?next=${encodeURIComponent(`/c/${code}`)}`} replace />
  if (card.error) return <Message error={card.error} />
  if (!card.data) {
    return (
      <main className="customer-page">
        <Loading />
      </main>
    )
  }

  switch (card.data.state) {
    case 'mine':
      return <Navigate to={`/${slug}/wallet`} replace />
    case 'free':
      return <Navigate to={`/${slug}/wallet?link=${code}`} replace />
    case 'taken':
      return <Message text={t('This card is linked to another account.')} slug={slug} />
    case 'blocked':
      return <Message text={t('This card is blocked.')} slug={slug} />
  }
}

function Message({ text, error, slug }: { text?: string; error?: unknown; slug?: string }) {
  return (
    <main className="customer-page">
      <section className="panel stack">
        <h1 className="panel-title">{t('Card')}</h1>
        {text ? <p>{text}</p> : <ErrorNote error={error} />}
        <Link className="btn" to={slug ? `/${slug}` : '/'}>
          {t('Go on')}
        </Link>
      </section>
    </main>
  )
}
