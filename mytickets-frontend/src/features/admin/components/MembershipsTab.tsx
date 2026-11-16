import { useState } from 'react'

import { QueryResult } from '@/components'
import { tierTerms } from '@/features/organisations'

import { useAdminTiers } from '../api/admin'
import type { AdminTier } from '../types'
import { TierForm } from './TierForm'

type MembershipsTabProps = {
  slug: string
}

export function MembershipsTab({ slug }: MembershipsTabProps) {
  const [editing, setEditing] = useState<AdminTier | 'new' | null>(null)
  const tiers = useAdminTiers(slug)

  return (
    <div className="stack">
      <p className="muted">
        A membership type is a way to join. Make it free or paid, open to everyone or invite-only (people need
        the code), and give it discounts on tickets and at the bar.
      </p>
      {editing ? (
        <TierForm
          key={editing === 'new' ? 'new' : editing.id}
          slug={slug}
          tier={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button className="btn primary" onClick={() => setEditing('new')}>
          New membership type
        </button>
      )}
      <QueryResult query={tiers}>
        {(list) => (
          <div className="list">
            {list.map((tier) => (
              <div key={tier.id} className={tier.archived ? 'list-item faded' : 'list-item'}>
                <div>
                  <strong>{tier.name}</strong> <span className="tag">{tierTerms(tier)}</span>
                  {!tier.isPublic && <span className="tag">Invite-only</span>}
                  {tier.archived && <span className="tag bad">Closed</span>}
                  <p className="muted">{tierFacts(tier)}</p>
                  {tier.inviteCode && (
                    <p>
                      Invite code: <code>{tier.inviteCode}</code>
                    </p>
                  )}
                </div>
                <button className="btn" onClick={() => setEditing(tier)}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}

function tierFacts(tier: AdminTier) {
  const facts = [`${tier.members} member${tier.members === 1 ? '' : 's'}`]
  if (tier.ticketDiscountPercent > 0) facts.push(`${tier.ticketDiscountPercent}% off tickets`)
  if (tier.drinkDiscountPercent > 0) facts.push(`${tier.drinkDiscountPercent}% off bar`)
  return facts.join(' · ')
}
