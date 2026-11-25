import { Link, useParams, useSearchParams } from 'react-router-dom'

import { QueryResult } from '@/components'
import { useFullscreen } from '@/hooks/useFullscreen'
import { t } from '@/lib/i18n'

import { useStaffContext } from '../api/staff'
import { BarMode } from '../components/BarMode'
import { CashTopUpMode } from '../components/CashTopUpMode'
import { CheckCardMode } from '../components/CheckCardMode'
import { DoorMode } from '../components/DoorMode'
import { MemberInfoMode } from '../components/MemberInfoMode'
import type { StaffTask } from '../types'

const MODES = { door: 'Door', bar: 'Bar', topup: 'Top up', check: 'Check card', members: 'Members' } as const
type Mode = keyof typeof MODES

/** Which screen does which job; someone only sees the screens for the jobs their role does. */
const TASK_OF: Record<Mode, StaffTask> = {
  door: 'Door',
  bar: 'Bar',
  topup: 'CashTopUp',
  check: 'CheckCard',
  members: 'MemberInfo',
}

/** What the people at the door and behind the bar use on their phone. */
export function StaffPage() {
  const { slug = '' } = useParams()
  // In the address, so coming back from a member's page lands on the same screen.
  const [params, setParams] = useSearchParams()
  const chosen = params.get('mode') as Mode | null
  const context = useStaffContext(slug)
  const fullscreen = useFullscreen()

  const tasks = context.data?.tasks ?? []
  const modes = (Object.keys(MODES) as Mode[]).filter((m) => tasks.includes(TASK_OF[m]))
  // A barman starts at the bar, a doorman at the door.
  const mode = chosen && modes.includes(chosen) ? chosen : modes[0]

  return (
    <main className={mode === 'bar' ? 'staff till-mode' : 'staff'}>
      <QueryResult query={context}>
        {(staff) => (
          <>
            <div className="staff-top">
              <Link to={`/${slug}`} className="back">
                ‹ {staff.name}
              </Link>
              {/* At the bar: the till on the whole screen, as on a register. */}
              {mode === 'bar' && fullscreen.supported && (
                <button
                  type="button"
                  className="btn ghost small"
                  aria-pressed={fullscreen.active}
                  onClick={() => void fullscreen.toggle()}
                >
                  {fullscreen.active ? t('Exit fullscreen') : t('Fullscreen')}
                </button>
              )}
            </div>
            {modes.length > 1 && (
              <nav className="tabs" aria-label={t('Staff mode')}>
                {modes.map((key) => (
                  <button
                    key={key}
                    className={mode === key ? 'tab active' : 'tab'}
                    aria-current={mode === key ? 'page' : undefined}
                    onClick={() => setParams({ mode: key }, { replace: true })}
                  >
                    {t(MODES[key])}
                  </button>
                ))}
              </nav>
            )}
            {mode === 'door' && <DoorMode slug={slug} events={staff.events} />}
            {mode === 'bar' && (
              <BarMode
                slug={slug}
                products={staff.products}
                categories={staff.categories ?? []}
                onMenuChanged={() => context.refetch()}
              />
            )}
            {mode === 'topup' && <CashTopUpMode slug={slug} />}
            {mode === 'check' && <CheckCardMode slug={slug} />}
            {mode === 'members' && <MemberInfoMode slug={slug} />}
          </>
        )}
      </QueryResult>
    </main>
  )
}
