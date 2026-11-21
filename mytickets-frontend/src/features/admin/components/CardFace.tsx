import { QRCodeSVG } from 'qrcode.react'
import type { CSSProperties } from 'react'

import { HOUSE_COLOR, isReadable, readableShade } from '@/features/organisations'
import { t } from '@/lib/i18n'

import type { CardSide } from '../types'

type CardFaceProps = {
  /** The front is the organisation's own; the back carries the QR code, and the number small in a corner. */
  side: 'front' | 'back'
  design: CardSide
  organisationName: string
  logoUrl: string | null
  brandColor: string | null
  /** Only for the organisation's own bookkeeping: small and faint, and never used to find the card. */
  number: string
  /** The card's link: what its QR holds. */
  url: string
}

/**
 * One side of a printed card at its real size (85.6 × 54 mm). The back's layout never changes, so the QR always
 * scans: the QR on a white tile on the right, the organisation's name on the left. The card number sits small and
 * faint in the bottom-right corner, under the QR, to tell cards apart; a card is only ever found by its QR code or its chip, never
 * by its number.
 */
export function CardFace({
  side,
  design,
  organisationName,
  logoUrl,
  brandColor,
  number,
  url,
}: CardFaceProps) {
  const className = `card-face ${side}${design.background === 'image' ? ' on-picture' : ''}`
  const logo = design.showLogo && logoUrl && <img className="card-face-logo" src={logoUrl} alt="" />

  if (side === 'front') {
    return (
      <div className={className} style={faceStyle(design, brandColor)}>
        <div className="card-face-front">
          {logo}
          <strong className="card-face-name">{organisationName}</strong>
          {design.tagline && <span className="card-face-tagline">{design.tagline}</span>}
        </div>
      </div>
    )
  }
  return (
    <div className={className} style={faceStyle(design, brandColor)}>
      <div className="card-face-text">
        {logo}
        <strong className="card-face-name">{organisationName}</strong>
        {design.tagline && <span className="card-face-tagline">{design.tagline}</span>}
      </div>
      <span className="card-face-number">{number}</span>
      <div className="card-face-qr">
        <QRCodeSVG value={url} size={160} marginSize={0} title={t('QR code of the card')} />
      </div>
    </div>
  )
}

/** The background, and text that reads on it: white on dark colours and pictures, near-black on light colours. */
function faceStyle(design: CardSide, brandColor: string | null): CSSProperties {
  if (design.background === 'image' && design.imageUrl) {
    return { backgroundImage: `url(${design.imageUrl})`, color: '#ffffff' }
  }
  if (design.background === 'colour' && design.colour) {
    return { background: design.colour, color: isReadable(design.colour) ? '#ffffff' : '#111111' }
  }
  return { background: readableShade(brandColor ?? HOUSE_COLOR), color: '#ffffff' }
}
