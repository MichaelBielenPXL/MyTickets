import { Link, Navigate, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'
import { useKeepAwake } from '@/hooks/useKeepAwake'
import { t } from '@/lib/i18n'

import { useStaffContext } from '../api/staff'
import { BarMode } from '../components/BarMode'

/**
 * The bar till on the whole screen, as on a register: no header, no tabs, and the screen kept awake. Its own page
 * rather than the browser's fullscreen, which iPhones don't allow.
 */
export function TillPage() {
  const { slug = '' } = useParams()
  const context = useStaffContext(slug)
  const bar = `/${slug}/staff?mode=bar`
  useKeepAwake(true)

  return (
    <main className="staff till-mode till-page">
      <QueryResult query={context}>
        {(staff) =>
          staff.tasks.includes('Bar') ? (
            <>
              <div className="staff-top">
                <Link to={bar} className="back">
                  ‹ {t('Bar')}
                </Link>
              </div>
              <BarMode
                slug={slug}
                products={staff.products}
                categories={staff.categories ?? []}
                onMenuChanged={() => context.refetch()}
              />
            </>
          ) : (
            <Navigate to={`/${slug}/staff`} replace />
          )
        }
      </QueryResult>
    </main>
  )
}
