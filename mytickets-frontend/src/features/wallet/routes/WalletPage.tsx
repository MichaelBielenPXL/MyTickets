import { Link, useParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'
import { useOrganisation } from '@/features/organisations'
import { money } from '@/utils/format'

import { useWallet } from '../api/wallet'
import { TopUpForm } from '../components/TopUpForm'
import { TransactionList } from '../components/TransactionList'

export function WalletPage() {
  const { slug = '' } = useParams()
  const organisationQuery = useOrganisation(slug)
  const walletQuery = useWallet(slug)

  const organisation = organisationQuery.data
  const wallet = walletQuery.data
  if (!organisation || !wallet) {
    const error = organisationQuery.error ?? walletQuery.error
    return (
      <main className="customer-page wallet-page">
        <Link to={`/${slug}`} className="back">
          ‹ Back
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
      <header className="wallet-hero">
        <h1>Your credit at {organisation.name}</h1>
        <p className="wallet-balance">{money(wallet.balanceCents)}</p>
        <p className="wallet-hero-note">Spend it on tickets, or at the bar with your card.</p>
      </header>
      <TopUpForm slug={slug} minCents={wallet.minTopUpCents} maxCents={wallet.maxTopUpCents} />
      <section className="content-section">
        <div className="section-heading">
          <h2>Recent activity</h2>
        </div>
        <TransactionList transactions={wallet.transactions} />
      </section>
    </main>
  )
}
