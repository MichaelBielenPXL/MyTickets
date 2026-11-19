import { t } from '@/lib/i18n'
import type { Tier } from '@/types'

import { tierBenefits, tierTerms } from '../utils/tier-terms'

type TierChoiceProps = {
  tier: Tier
  /** The button text, or null for no button (invite-only types are reached with their code). */
  action: string | null
  disabled?: boolean
  onChoose: () => void
}

/** One membership type to choose from: price, end date, benefits, and whether it needs approval. */
export function TierChoice({ tier, action, disabled, onChoose }: TierChoiceProps) {
  return (
    <div className="list-item">
      <div className="list-item-main">
        <strong>{tier.name}</strong> <span className="tag">{tierTerms(tier)}</span>
        {tier.requiresApproval && <span className="tag">{t('Needs approval')}</span>}
        {tier.description && <p className="muted">{tier.description}</p>}
        {tierBenefits(tier) && <p className="muted">{tierBenefits(tier)}</p>}
      </div>
      {action && (
        <button className="btn primary" disabled={disabled} onClick={onChoose}>
          {action}
        </button>
      )}
    </div>
  )
}
