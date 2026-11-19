import { CardReader, ErrorNote } from '@/components'
import { t } from '@/lib/i18n'
import { money } from '@/utils/format'
import { cardIdFromQr } from '@/utils/qr'

import { useLookUpCard } from '../api/staff'
import { ScanQrButton } from './ScanQrButton'

type CheckCardModeProps = {
  slug: string
}

/** Tap a card or scan a member or card QR code to see whose it is and how many tokens are on it. */
export function CheckCardMode({ slug }: CheckCardModeProps) {
  const lookUp = useLookUpCard(slug)
  const holder = lookUp.data

  return (
    <div className="stack">
      {holder && !lookUp.isError && (
        <div className="panel">
          <div className="spread">
            <div>
              <strong>{holder.name}</strong>
              <p className={holder.membershipActive ? 'muted' : 'bad'}>
                {holder.tier}
                {!holder.membershipActive && ` · ${t('expired')}`}
              </p>
            </div>
            <strong className="big-number">{money(holder.balanceCents)}</strong>
          </div>
          {holder.drinkDiscountPercent > 0 && (
            <p className="muted">
              {t('{percent}% off at the bar', { percent: holder.drinkDiscountPercent })}
            </p>
          )}
        </div>
      )}
      <ErrorNote error={lookUp.error} />
      <ScanQrButton
        onScan={(payload) => lookUp.mutate(cardIdFromQr(payload))}
        disabled={lookUp.isPending}
        cameraProblem={t(
          'The camera could not start. Allow camera access for this site, or type the card number.',
        )}
      />
      <CardReader
        prompt={t('Tap a card to see who it belongs to and how many tokens are on it')}
        onCard={(cardUid) => lookUp.mutate(cardUid)}
      />
    </div>
  )
}
