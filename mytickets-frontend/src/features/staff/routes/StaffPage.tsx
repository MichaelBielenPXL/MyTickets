import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'

import { useStaffContext } from '../api/staff'
import { BarMode } from '../components/BarMode'
import { CashTopUpMode } from '../components/CashTopUpMode'
import { CheckCardMode } from '../components/CheckCardMode'
import { DoorMode } from '../components/DoorMode'

const MODES = { door: 'Door', bar: 'Bar', topup: 'Top up', check: 'Check card' } as const
type Mode = keyof typeof MODES

/** What the people at the door and behind the bar use on their phone. */
export function StaffPage() {
  const { slug = '' } = useParams()
  const [mode, setMode] = useState<Mode>('door')
  const context = useStaffContext(slug)

  return (
    <main className="staff">
      <QueryResult query={context}>
        {(staff) => (
          <>
            <Link to={`/${slug}`} className="back">
              ‹ {staff.name}
            </Link>
            <nav className="tabs" aria-label="Staff mode">
              {(Object.keys(MODES) as Mode[]).map((key) => (
                <button
                  key={key}
                  className={mode === key ? 'tab active' : 'tab'}
                  aria-current={mode === key ? 'page' : undefined}
                  onClick={() => setMode(key)}
                >
                  {MODES[key]}
                </button>
              ))}
            </nav>
            {mode === 'door' && <DoorMode slug={slug} events={staff.events} />}
            {mode === 'bar' && (
              <BarMode slug={slug} products={staff.products} onMenuChanged={() => context.refetch()} />
            )}
            {mode === 'topup' && <CashTopUpMode slug={slug} />}
            {mode === 'check' && <CheckCardMode slug={slug} />}
          </>
        )}
      </QueryResult>
    </main>
  )
}
