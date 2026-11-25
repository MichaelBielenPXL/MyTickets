import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { type Me, type Membership, useSignOut } from '@/features/auth'
import { useDismiss } from '@/hooks/useDismiss'
import { t } from '@/lib/i18n'

type UserMenuProps = {
  me: Me
  /** The account at the organisation the app is in, when there is one. */
  account: Membership | null
}

/** The round button top-right: who is signed in here, their own pages, and signing out. */
export function UserMenu({ me, account }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const signOut = useSignOut()
  useDismiss(container, open, close)

  // Their name as this organisation knows it (once they joined), and their MyTickets account's address.
  const name = account?.displayName ?? me.displayName
  const email = me.email

  return (
    <div className="user-menu" ref={container}>
      <button
        type="button"
        className="user-button"
        aria-expanded={open}
        aria-label={t('Account menu')}
        onClick={() => setOpen(!open)}
      >
        {initials(name)}
      </button>
      {open && (
        <div className="menu user-menu-panel">
          <div className="menu-identity">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          <div className="menu-separator" />
          {account && (
            <>
              <Link to={`/${account.slug}/tickets`} className="menu-item" onClick={close}>
                {t('My tickets')}
              </Link>
              <Link to={`/${account.slug}/wallet`} className="menu-item" onClick={close}>
                {t('My wallet')}
              </Link>
              <Link to={`/${account.slug}/profile`} className="menu-item" onClick={close}>
                {t('My details')}
              </Link>
            </>
          )}
          <Link to="/discover" className="menu-item" onClick={close}>
            {t('Browse organisations')}
          </Link>

          <div className="menu-separator" />
          <button
            type="button"
            className="menu-item"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            {t('Sign out')}
          </button>
        </div>
      )}
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}
