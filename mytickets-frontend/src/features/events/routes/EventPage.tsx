import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'
import { useMe } from '@/features/auth'
import { useOrganisation, usePublicOrganisation } from '@/features/organisations'
import { useGoToCheckout } from '@/hooks/useGoToCheckout'
import { t } from '@/lib/i18n'
import { dateTime } from '@/utils/format'

import { useEvent, useOrderTickets, usePublicEvent } from '../api/events'
import { OrderBar } from '../components/OrderBar'
import { TicketTypeRow } from '../components/TicketTypeRow'

export function EventPage() {
  const { slug = '', eventId = '' } = useParams()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const navigate = useNavigate()
  const goToCheckout = useGoToCheckout()
  // Signed in to MyTickets: the page for them (joined or not yet); otherwise the public page.
  const me = useMe()
  const eventQuery = useEvent(slug, eventId, Boolean(me.data))
  const publicEventQuery = usePublicEvent(slug, eventId, !me.isPending && !me.data)
  const organisationQuery = useOrganisation(slug, Boolean(me.data))
  const publicOrganisationQuery = usePublicOrganisation(slug, !me.isPending && !me.data)
  const order = useOrderTickets(slug, eventId)

  const event = me.data ? eventQuery.data : publicEventQuery.data
  const organisation = me.data ? organisationQuery.data : publicOrganisationQuery.data
  if (me.isPending)
    return (
      <main>
        <Loading />
      </main>
    )
  if (!event || !organisation) {
    const error =
      eventQuery.error ?? publicEventQuery.error ?? organisationQuery.error ?? publicOrganisationQuery.error
    return (
      <>
        <main>{error ? <ErrorNote error={error} /> : <Loading />}</main>
      </>
    )
  }

  const isMember = organisation.membership?.active === true
  const picked = event.ticketTypes.filter((t) => (quantities[t.id] ?? 0) > 0)
  const ticketCount = picked.reduce((sum, t) => sum + quantities[t.id], 0)
  const totalCents = picked.reduce((sum, t) => sum + quantities[t.id] * t.yourPriceCents, 0)

  function placeOrder(payWith: 'online' | 'wallet') {
    const items = picked.map((t) => ({ ticketTypeId: t.id, quantity: quantities[t.id] }))
    order.mutate(
      { items, payWith },
      {
        // Free tickets, or paid with tokens, are theirs straight away; otherwise on to paying.
        onSuccess: (result) =>
          result.checkoutUrl ? goToCheckout(result.checkoutUrl) : navigate(`/${slug}/tickets`),
      },
    )
  }

  return (
    <>
      <main className="customer-page event-page">
        <Link to={`/${slug}`} className="back">
          ‹ {organisation.name}
        </Link>
        {event.imageUrl && <img className="event-image" src={event.imageUrl} alt="" />}
        <header className="event-heading">
          <p className="event-organiser">{organisation.name}</p>
          <h1>{event.name}</h1>
          <p className="lead">
            {dateTime(event.startsAt)}
            {event.location && ` · ${event.location}`}
          </p>
        </header>
        {event.description && <p className="prose event-description">{event.description}</p>}

        {event.status === 'Closed' && (
          <p className="note" role="status">
            {t('This event has ended. Tickets are no longer sold.')}
          </p>
        )}
        <section className="content-section event-ticket-section">
          <div className="section-heading">
            <h2>{t('Choose your tickets')}</h2>
          </div>
          {event.ticketTypes.length === 0 && <p className="muted">{t('Tickets are not on sale yet.')}</p>}
          <div className="list">
            {event.ticketTypes.map((ticketType) => (
              <TicketTypeRow
                key={ticketType.id}
                ticketType={ticketType}
                quantity={quantities[ticketType.id] ?? 0}
                canBuy={isMember}
                onChange={(quantity) => setQuantities((q) => ({ ...q, [ticketType.id]: quantity }))}
              />
            ))}
          </div>
        </section>

        <ErrorNote error={order.error} />
        {!isMember &&
          (me.data ? (
            <p className="note">
              <Link to={`/${slug}`}>
                {organisation.membership
                  ? t('Renew your membership')
                  : t('Join {org}', { org: organisation.name })}
              </Link>{' '}
              {t('to buy tickets.')}
            </p>
          ) : (
            <p className="note event-auth-note">
              <Link to={`/${slug}/register`}>{t('Register for {org}', { org: organisation.name })}</Link>{' '}
              {t('or')} <Link to={`/${slug}/login`}>{t('log in')}</Link> {t('to join and buy tickets.')}
            </p>
          ))}
        {isMember && ticketCount > 0 && (
          <OrderBar
            ticketCount={ticketCount}
            totalCents={totalCents}
            balanceCents={organisation.balanceCents ?? 0}
            busy={order.isPending}
            onOrder={placeOrder}
          />
        )}
      </main>
    </>
  )
}
