import { QRCodeSVG } from 'qrcode.react'
import type { ReactNode } from 'react'

import { t } from '@/lib/i18n'

import { useMemberPass } from '../api/organisations'

type MemberPassPanelProps = {
  slug: string
  organisationName: string
}

/**
 * The member's QR code. Staff scan it at the door and the bar exactly as they would tap the member's
 * card, so a phone is enough. It can also be saved to Apple Wallet or Google Wallet.
 */
export function MemberPassPanel({ slug, organisationName }: MemberPassPanelProps) {
  const pass = useMemberPass(slug).data
  if (!pass) return null

  // Only the wallet this phone has: Apple Wallet on an iPhone, Google Wallet on Android, none on a
  // computer. On a developer's machine the button shows even without wallet keys, so the layout can be seen.
  const device = walletOfThisDevice()
  const showApple = device === 'apple' && (pass.appleWallet || import.meta.env.DEV)
  const showGoogle = device === 'google' && (pass.googleWallet || import.meta.env.DEV)

  return (
    <section className="member-pass" aria-label={t('Your member QR code')}>
      <div className="member-pass-qr">
        <QRCodeSVG
          value={pass.code}
          size={132}
          marginSize={0}
          title={t('{org} member QR code', { org: organisationName })}
        />
      </div>
      <code className="member-pass-code">{pass.display}</code>
      {(showApple || showGoogle) && (
        <div className="wallet-buttons">
          {showApple && (
            <WalletButton
              href={`/api/orgs/${slug}/me/pass/apple`}
              ready={pass.appleWallet}
              label={t('Add to Apple Wallet')}
            >
              <AppleWalletMark />
            </WalletButton>
          )}
          {showGoogle && (
            <WalletButton
              href={`/api/orgs/${slug}/me/pass/google`}
              ready={pass.googleWallet}
              label={t('Add to Google Wallet')}
            >
              <GoogleWalletMark />
            </WalletButton>
          )}
        </div>
      )}
    </section>
  )
}

/** Which wallet app this device has, judged from the browser. iPads that say they are a Mac count as Apple. */
function walletOfThisDevice(): 'apple' | 'google' | null {
  const agent = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(agent)) return 'apple'
  if (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1) return 'apple'
  if (/Android/i.test(agent)) return 'google'
  return null
}

function WalletButton({
  href,
  ready,
  label,
  children,
}: {
  href: string
  ready: boolean
  label: string
  children: ReactNode
}) {
  if (!ready) {
    return (
      <span
        className="wallet-button"
        aria-disabled="true"
        title={t('Wallet keys are not set up on this server yet')}
      >
        {children}
        {label}
      </span>
    )
  }
  return (
    <a className="wallet-button" href={href}>
      {children}
      {label}
    </a>
  )
}

function AppleWalletMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#fff" fillOpacity="0.18" />
      <path d="M3 9.5h18" stroke="#ff9f0a" strokeWidth="2" />
      <path d="M3 12.5h18" stroke="#30d158" strokeWidth="2" />
      <path d="M3 15.5h18" stroke="#0a84ff" strokeWidth="2" />
    </svg>
  )
}

function GoogleWalletMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1H4z" fill="#ea4335" />
      <path d="M4 9h16v3H4z" fill="#fbbc04" />
      <path d="M4 12h16v3H4z" fill="#34a853" />
      <path d="M4 15h16v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#4285f4" />
    </svg>
  )
}
