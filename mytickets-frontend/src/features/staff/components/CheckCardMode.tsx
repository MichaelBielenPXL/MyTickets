import { CardReader, ErrorNote } from '@/components'
import { money } from '@/utils/format'

import { useLookUpCard } from '../api/staff'

type CheckCardModeProps = {
  slug: string
}

/** Tap a card to see whose it is and how much credit is on it. */
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
                {!holder.membershipActive && ' · expired'}
              </p>
            </div>
            <strong className="big-number">{money(holder.balanceCents)}</strong>
          </div>
          {holder.drinkDiscountPercent > 0 && (
            <p className="muted">{holder.drinkDiscountPercent}% off at the bar</p>
          )}
        </div>
      )}
      <ErrorNote error={lookUp.error} />
      <CardReader
        prompt="Tap a card to see who it belongs to and how much credit is on it"
        onCard={(cardUid) => lookUp.mutate(cardUid)}
      />
    </div>
  )
}
