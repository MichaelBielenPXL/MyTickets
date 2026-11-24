import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

import { t } from '@/lib/i18n'
import { dateTime } from '@/utils/format'

import type { MyTicket } from '../types'
import { downloadTicketPdf } from '../utils/ticket-pdf'

type TicketCardProps = {
  ticket: MyTicket
  /** Printed on the PDF; left off when unknown. */
  holderName: string | null
  /** Whether the QR code is showing. */
  open: boolean
  onToggle: () => void
}

export function TicketCard({ ticket, holderName, open, onToggle }: TicketCardProps) {
  const used = ticket.status === 'CheckedIn'
  const [saving, setSaving] = useState(false)

  async function download() {
    setSaving(true)
    try {
      await downloadTicketPdf(ticket, holderName)
    } finally {
      setSaving(false)
    }
  }

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
          <button type="button" className="btn small" disabled={saving} onClick={() => void download()}>
            {saving ? t('One moment…') : t('Download PDF')}
          </button>
        </div>
      )}
    </div>
  )
}
