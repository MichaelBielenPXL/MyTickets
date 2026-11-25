import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { CardReader, ErrorNote, QueryResult } from '@/components'
import { t } from '@/lib/i18n'
import { cardIdFromQr } from '@/utils/qr'

import { useLookUpCard, useStaffMembers } from '../api/staff'
import { ScanQrButton } from './ScanQrButton'

type MemberInfoModeProps = {
  slug: string
}

/**
 * Members, for staff and admins: find someone by name or email, or by tapping or scanning their card, and
 * open their page (details, tokens, cards and memberships over the years).
 */
export function MemberInfoMode({ slug }: MemberInfoModeProps) {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const lookUp = useLookUpCard(slug)
  const members = useStaffMembers(slug, useDeferredValue(search.trim()))

  const pageOf = (id: string) => `/${slug}/members/${id}`
  const fromHere = { from: `/${slug}/staff?mode=members` }

  function openCard(cardUid: string) {
    lookUp.mutate(cardUid, { onSuccess: (holder) => navigate(pageOf(holder.memberId), { state: fromHere }) })
  }

  return (
    <div className="stack member-info">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search by name or email')}
        aria-label={t('Search members')}
      />
      <QueryResult query={members}>
        {(found) =>
          found.length === 0 ? (
            <p className="muted">{t('Nobody found.')}</p>
          ) : (
            <ul className="list member-info-results">
              {found.map((member) => (
                <li key={member.id}>
                  <Link to={pageOf(member.id)} state={fromHere} className="list-item">
                    <span>
                      <strong>{member.displayName}</strong>
                      <span className="muted"> · {member.email}</span>
                    </span>
                    <span className={member.membershipActive ? 'muted' : 'bad'}>
                      {member.tier}
                      {!member.membershipActive && ` · ${t('expired')}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </QueryResult>
      <ErrorNote error={lookUp.error} />
      <ScanQrButton
        onScan={(payload) => openCard(cardIdFromQr(payload))}
        disabled={lookUp.isPending}
        cameraProblem={t('The camera could not start. Allow camera access for this site, or tap the card.')}
      />
      <CardReader prompt={t('Tap a card to see whose it is')} onCard={openCard} disabled={lookUp.isPending} />
    </div>
  )
}
