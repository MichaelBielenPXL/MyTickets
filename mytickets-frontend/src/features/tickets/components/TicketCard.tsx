import { QRCodeSVG } from 'qrcode.react'

import { getLanguage, t } from '@/lib/i18n'
import { dateTime } from '@/utils/format'

import type { MyTicket } from '../types'

type TicketCardProps = {
  ticket: MyTicket
  /** Whether the QR code is showing. */
  open: boolean
  onToggle: () => void
}

export function TicketCard({ ticket, open, onToggle }: TicketCardProps) {
  const used = ticket.status === 'CheckedIn'

  return (
    <div className="ticket">
      <button className="list-item" onClick={onToggle} aria-expanded={open}>
        <div>
          <strong>{ticket.eventName}</strong>
          <p className="muted">
            {ticket.ticketType} · {dateTime(ticket.startsAt)}
          </p>
          <p className="muted">
            {ticket.organisationName}
            {ticket.location && ` · ${ticket.location}`}
          </p>
        </div>
        <span className={used ? 'tag' : 'tag good'}>{used ? 'Used' : 'Valid'}</span>
      </button>
      {open && (
        <div className="qr">
          <QRCodeSVG
            value={ticket.code}
            size={220}
            marginSize={2}
            title={t('QR code for {event}', { event: ticket.eventName })}
          />
          <code>{ticket.code}</code>
          <p className="muted">{t('Show this at the door, or tap your card.')}</p>
          {/* Made by the server: the same PDF as in the email after buying. */}
          <a
            className="btn small"
            href={`/api/orgs/${ticket.organisationSlug}/me/tickets/${ticket.id}/pdf?lang=${getLanguage()}`}
            download
          >
            {t('Download PDF')}
          </a>
        </div>
      )}
    </div>
  )
}
