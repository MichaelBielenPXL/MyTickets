import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { Membership } from '@/features/auth'
import { useDismiss } from '@/hooks/useDismiss'

import { OrganisationAvatar } from './OrganisationAvatar'

type OrganisationSwitcherProps = {
  memberships: Membership[]
  /** The organisation the app is currently in, if any. */
  current: { slug: string; name: string; logoUrl: string | null } | null
  /** Shown as a small label next to the name, e.g. the person's role. */
  currentLabel?: string
  canCreate: boolean
}

// Searching only earns its place once the list no longer fits at a glance.
const SEARCH_FROM = 6

/** Top-left control that shows which organisation you are in and lets you move to another. */
export function OrganisationSwitcher({
  memberships,
  current,
  currentLabel,
  canCreate,
}: OrganisationSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])
  useDismiss(container, open, close)

  const wanted = search.trim().toLowerCase()
  const shown = wanted ? memberships.filter((m) => m.name.toLowerCase().includes(wanted)) : memberships

  return (
    <div className="switcher" ref={container}>
      {current && (
        <Link to={`/${current.slug}`} className="switcher-current">
          <OrganisationAvatar name={current.name} logoUrl={current.logoUrl} />
          <span className="switcher-name">{current.name}</span>
          {currentLabel && <span className="pill">{currentLabel}</span>}
        </Link>
      )}
      <button
        type="button"
        className="switcher-toggle"
        aria-expanded={open}
        aria-label={current ? 'Switch organisation' : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {!current && <span>Choose organisation</span>}
        <UpDownIcon />
      </button>

      {open && (
        <div className="menu switcher-menu">
          {memberships.length >= SEARCH_FROM && (
            <input
              type="search"
              className="menu-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find organisation…"
              aria-label="Find organisation"
              autoFocus
            />
          )}
          <p className="menu-label">Your organisations</p>
          <nav aria-label="Your organisations">
            {shown.map((membership) => (
              <Link
                key={membership.slug}
                to={`/${membership.slug}`}
                className="menu-item"
                aria-current={membership.slug === current?.slug ? 'true' : undefined}
                onClick={close}
              >
                <OrganisationAvatar name={membership.name} logoUrl={membership.logoUrl} />
                <span className="menu-item-text">{membership.name}</span>
                {membership.slug === current?.slug && <CheckIcon />}
              </Link>
            ))}
          </nav>
          {shown.length === 0 && (
            <p className="menu-empty">
              {memberships.length === 0 ? 'You have not joined one yet.' : 'No match.'}
            </p>
          )}
          <div className="menu-separator" />
          <Link to="/discover" className="menu-item" onClick={close}>
            <SearchIcon />
            <span className="menu-item-text">Browse organisations</span>
          </Link>
          {canCreate && (
            <Link to="/discover?new=1" className="menu-item" onClick={close}>
              <PlusIcon />
              <span className="menu-item-text">Create organisation</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

const icon = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function UpDownIcon() {
  return (
    <svg {...icon}>
      <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg {...icon}>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg {...icon}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg {...icon}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}
