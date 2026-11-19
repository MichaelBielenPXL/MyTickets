import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'
import { CardsSummary, LinkCardDialog } from '@/features/cards'
import { useOrganisation } from '@/features/organisations'
import { t } from '@/lib/i18n'
import { tokenBalance } from '@/utils/format'

import { useWallet } from '../api/wallet'
import { TopUpForm } from '../components/TopUpForm'
import { TransactionList } from '../components/TransactionList'

/** "My wallet": tokens at this organisation, topping up, the cards that pay with it, and what happened. */
export function WalletPage() {
  const { slug = '' } = useParams()
  // ?link=<code>: a card was just tapped (or scanned) that nobody has claimed yet.
  const [params, setParams] = useSearchParams()
  const linkCode = params.get('link')
  const organisationQuery = useOrganisation(slug)
  const organisation = organisationQuery.data
  // There is only a wallet once someone has a membership; their cards can be linked before that.
  const hasWallet = Boolean(organisation?.membership)
  const walletQuery = useWallet(slug, hasWallet)
  const wallet = walletQuery.data

  if (!organisation || (hasWallet && !wallet)) {
    const error = organisationQuery.error ?? walletQuery.error
    return (
      <main className="customer-page wallet-page">
        <Link to={`/${slug}`} className="back">
          {t('‹ Back')}
        </Link>
        {error ? <ErrorNote error={error} /> : <Loading />}
      </main>
    )
  }

  return (
    <main className="customer-page wallet-page">
      <Link to={`/${slug}`} className="back">
        ‹ {organisation.name}
      </Link>
      {linkCode && (
        <LinkCardDialog slug={slug} code={linkCode} onDone={() => setParams({}, { replace: true })} />
      )}
      {wallet ? (
        <>
          <header className="wallet-hero">
            <h1>{t('Saldo at {org}', { org: organisation.name })}</h1>
            <p className="wallet-balance">{tokenBalance(wallet.balanceCents)}</p>
            <p className="wallet-hero-note">
              {wallet.deals?.length
                ? t('Spend them on tickets, or at the bar with your card.')
                : t('One token is one euro. Spend them on tickets, or at the bar with your card.')}
            </p>
          </header>
          <TopUpForm
            slug={slug}
            minCents={wallet.minTopUpCents}
            maxCents={wallet.maxTopUpCents}
            deals={wallet.deals ?? []}
          />
        </>
      ) : (
        <section className="panel stack">
          <h1 className="panel-title">{t('No tokens yet')}</h1>
          <p className="muted">You get a wallet at {organisation.name} as soon as you choose a membership.</p>
          <Link className="btn primary" to={`/${slug}/join`}>
            {t('Choose a membership')}
          </Link>
        </section>
      )}
      <CardsSummary slug={slug} />
      {wallet && (
        <section className="content-section">
          <div className="section-heading">
            <h2>{t('Recent activity')}</h2>
          </div>
          <TransactionList transactions={wallet.transactions} />
        </section>
      )}
    </main>
  )
}
