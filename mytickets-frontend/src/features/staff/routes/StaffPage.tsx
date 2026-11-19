import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useStaffContext } from '../api/staff'
import { BarMode } from '../components/BarMode'
import { CashTopUpMode } from '../components/CashTopUpMode'
import { CheckCardMode } from '../components/CheckCardMode'
import { DoorMode } from '../components/DoorMode'
import type { StaffTask } from '../types'

const MODES = { door: 'Door', bar: 'Bar', topup: 'Top up', check: 'Check card' } as const
type Mode = keyof typeof MODES

/** Which screen does which job; someone only sees the screens for the jobs their role does. */
const TASK_OF: Record<Mode, StaffTask> = { door: 'Door', bar: 'Bar', topup: 'CashTopUp', check: 'CheckCard' }

/** What the people at the door and behind the bar use on their phone. */
export function StaffPage() {
  const { slug = '' } = useParams()
  const [chosen, setChosen] = useState<Mode | null>(null)
  const context = useStaffContext(slug)

  const tasks = context.data?.tasks ?? []
  const modes = (Object.keys(MODES) as Mode[]).filter((m) => tasks.includes(TASK_OF[m]))
  // A barman starts at the bar, a doorman at the door.
  const mode = chosen && modes.includes(chosen) ? chosen : modes[0]

  return (
    <main className={mode === 'bar' ? 'staff till-mode' : 'staff'}>
      <QueryResult query={context}>
        {(staff) => (
          <>
            <Link to={`/${slug}`} className="back">
              ‹ {staff.name}
            </Link>
            {modes.length > 1 && (
              <nav className="tabs" aria-label={t('Staff mode')}>
                {modes.map((key) => (
                  <button
                    key={key}
                    className={mode === key ? 'tab active' : 'tab'}
                    aria-current={mode === key ? 'page' : undefined}
                    onClick={() => setChosen(key)}
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
          </>
        )}
      </QueryResult>
    </main>
  )
}
