import { t } from '@/lib/i18n'
import { dateTime } from '@/utils/format'

import type { MyTicket } from '../types'

const PAGE_WIDTH = 210
const MARGIN = 20
const QR_SIZE = 75

/**
 * Saves the ticket as a one-page A4 PDF: what it is for, and its QR code to scan at the door. The QR code is drawn
 * as vector squares, so it stays sharp at any print size. The PDF libraries load only when this is called.
 */
export async function downloadTicketPdf(ticket: MyTicket, holderName: string | null) {
  const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode')])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const centre = PAGE_WIDTH / 2
  let y = MARGIN + 6

  // Who it is from, and for what.
  pdf.setFont('helvetica', 'normal').setFontSize(11).setTextColor(110)
  pdf.text(ticket.organisationName.toUpperCase(), MARGIN, y)
  y += 11
  pdf.setFont('helvetica', 'bold').setFontSize(24).setTextColor(20)
  const title = pdf.splitTextToSize(ticket.eventName, PAGE_WIDTH - 2 * MARGIN) as string[]
  pdf.text(title, MARGIN, y)
  y += title.length * 10
  pdf.setFont('helvetica', 'normal').setFontSize(13).setTextColor(50)
  pdf.text(dateTime(ticket.startsAt), MARGIN, y)
  if (ticket.location) pdf.text(ticket.location, MARGIN, (y += 7))

  // The ticket itself.
  y += 10
  pdf
    .setDrawColor(220)
    .setLineWidth(0.4)
    .line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 10
  pdf.setFontSize(10).setTextColor(110).text(t('Ticket'), MARGIN, y)
  if (holderName) pdf.text(t('Name'), centre, y)
  y += 6
  pdf.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20).text(ticket.ticketType, MARGIN, y)
  if (holderName) pdf.text(holderName, centre, y)

  // The code to scan, in the middle of the page.
  y += 14
  const qr = QRCode.create(ticket.code, { errorCorrectionLevel: 'M' })
  const cells = qr.modules.size
  const cell = QR_SIZE / cells
  const left = centre - QR_SIZE / 2
  pdf.setFillColor(0, 0, 0)
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++)
      if (qr.modules.get(row, col)) pdf.rect(left + col * cell, y + row * cell, cell, cell, 'F')
  y += QR_SIZE + 9
  pdf.setFont('courier', 'normal').setFontSize(12).setTextColor(50)
  pdf.text(ticket.code, centre, y, { align: 'center' })

  y += 12
  pdf.setFont('helvetica', 'normal').setFontSize(11).setTextColor(80)
  pdf.text(t('Show this QR code at the door. Each ticket gets you in once.'), centre, y, { align: 'center' })
  if (ticket.status === 'CheckedIn' && ticket.checkedInAt) {
    pdf.setTextColor(180, 35, 24)
    pdf.text(t('Already used: checked in {when}.', { when: dateTime(ticket.checkedInAt) }), centre, y + 7, {
      align: 'center',
    })
  }

  pdf.save(fileName(ticket))
}

/** "night-owls-halloween-party-regular.pdf": readable, and safe on every system. */
function fileName(ticket: MyTicket) {
  const part = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `${[ticket.organisationSlug, part(ticket.eventName), part(ticket.ticketType)].filter(Boolean).join('-')}.pdf`
}
