import { Link, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'

import { useCards } from '../api/cards'
import { CardList } from '../components/CardList'
import { LinkCardForm } from '../components/LinkCardForm'

/** Managing the cards that pay with the wallet: opened from "Manage cards" in the wallet. */
export function CardsPage() {
  const { slug = '' } = useParams()
  const cards = useCards(slug)

  return (
    <main className="customer-page wallet-page">
      <Link to={`/${slug}/wallet`} className="back">
        ‹ My wallet
      </Link>
      <header className="page-heading">
        <div>
          <h1>Your cards</h1>
          <p className="lead">
            Tap a linked card at the door to get in, and at the bar to pay with your tokens.
          </p>
        </div>
      </header>
      <div className="stack page-stack">
        <QueryResult query={cards}>{(list) => <CardList slug={slug} cards={list} />}</QueryResult>
        <LinkCardForm slug={slug} />
        <p className="muted page-footnote">
          Lost a card? Block it here and nobody can spend your tokens with it.
        </p>
      </div>
    </main>
  )
}
