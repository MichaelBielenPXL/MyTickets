import { Link } from 'react-router-dom'

import { t } from '@/lib/i18n'

import { useCards } from '../api/cards'

type CardsSummaryProps = {
  slug: string
}

/** One row in the wallet: how many cards pay with it, and the way to manage them. */
export function CardsSummary({ slug }: CardsSummaryProps) {
  const cards = useCards(slug)
  const working = cards.data?.filter((c) => !c.blocked).length ?? 0
  const blocked = (cards.data?.length ?? 0) - working

  let status = t('Loading…')
  if (cards.isError) status = t("Couldn't load your cards.")
  else if (cards.data)
    status =
      working === 0
        ? t('No card linked yet')
        : (working === 1 ? t('1 card linked') : t('{count} cards linked', { count: working })) +
          (blocked ? ' · ' + t('{count} blocked', { count: blocked }) : '')

  return (
    <section className="panel cards-summary">
      <span className="cards-summary-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 9.5h19M6.5 15h4" strokeLinecap="round" />
        </svg>
      </span>
      <div className="cards-summary-text">
        <h2>{t('Cards')}</h2>
        <p className="muted">{status}</p>
      </div>
      <Link className="btn" to={`/${slug}/wallet/cards`}>
        {t('Manage cards')}
      </Link>
    </section>
  )
}
