import { Link } from 'react-router-dom'

import type { OrganisationSummary } from '../types'
import { OrganisationAvatar } from './OrganisationAvatar'

type OrganisationListProps = {
  organisations: OrganisationSummary[]
}

export function OrganisationList({ organisations }: OrganisationListProps) {
  return (
    <div className="list">
      {organisations.map((organisation) => (
        <Link key={organisation.slug} to={`/${organisation.slug}`} className="list-item">
          <OrganisationAvatar name={organisation.name} logoUrl={organisation.logoUrl} size={36} />
          <div className="list-item-main">
            <strong>{organisation.name}</strong>
            {organisation.description && <p className="muted">{organisation.description}</p>}
          </div>
          <span className="chevron" aria-hidden>
            ›
          </span>
        </Link>
      ))}
    </div>
  )
}
