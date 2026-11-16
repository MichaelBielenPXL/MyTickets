import { useParams } from 'react-router-dom'

import { QueryResult } from '@/components'

import { useCards } from '../api/cards'
import { CardList } from '../components/CardList'
import { LinkCardForm } from '../components/LinkCardForm'

export function CardsPage() {
  const { slug = '' } = useParams()
  const cards = useCards(slug)

  return (
    <main className="customer-page cards-page">
      <header className="page-heading">
        <div>
          <h1>Your cards</h1>
          <p className="lead">
            Link a card to your account here. Tap it at the door to get in and at the bar to pay with your
            credit.
          </p>
        </div>
      </header>
      <div className="stack page-stack">
        <QueryResult query={cards}>{(list) => <CardList slug={slug} cards={list} />}</QueryResult>
        <LinkCardForm slug={slug} />
        <p className="muted page-footnote">
          Lost a card? Block it here and nobody can spend your credit with it.
        </p>
      </div>
    </main>
  )
}
