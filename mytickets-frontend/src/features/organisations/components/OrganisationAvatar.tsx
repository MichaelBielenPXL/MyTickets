type OrganisationAvatarProps = {
  name: string
  logoUrl?: string | null
  /** Width and height in pixels. */
  size?: number
}

/** The organisation's logo, or a coloured tile with its first letter when it has none. */
export function OrganisationAvatar({ name, logoUrl, size = 20 }: OrganisationAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.5) }

  if (logoUrl) {
    // Decorative: the organisation's name is always written next to it.
    return <img className="org-avatar" src={logoUrl} alt="" style={style} />
  }
  return (
    <span className="org-avatar" aria-hidden style={{ ...style, background: gradientFor(name) }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** The same name always gets the same two colours, so an organisation is recognisable without a logo. */
function gradientFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return `linear-gradient(135deg, hsl(${hash} 70% 45%), hsl(${(hash + 60) % 360} 75% 55%))`
}
