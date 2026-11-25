import { t } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

/** Sun or moon in the header: switches between the light and the dark look. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t('Switch to light mode') : t('Switch to dark mode')}
      title={dark ? t('Switch to light mode') : t('Switch to dark mode')}
      className="inline-flex size-[34px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-text transition-colors hover:bg-fill"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  )
}
