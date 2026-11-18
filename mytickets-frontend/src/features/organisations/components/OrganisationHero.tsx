import { OrganisationAvatar } from './OrganisationAvatar'

type OrganisationHeroProps = {
  name: string
  description: string
  logoUrl: string | null
}

/** The top of an organisation's page: its logo large and centred (sized in CSS), its name and a line about it below. */
export function OrganisationHero({ name, description, logoUrl }: OrganisationHeroProps) {
  return (
    <header className="org-hero">
      <OrganisationAvatar name={name} logoUrl={logoUrl} size={128} />
      <div>
        <h1>{name}</h1>
        {description && <p className="lead">{description}</p>}
      </div>
    </header>
  )
}
