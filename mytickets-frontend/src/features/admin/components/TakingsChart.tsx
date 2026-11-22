import { useState } from 'react'

import { locale, t } from '@/lib/i18n'
import { money, tokenPrice } from '@/utils/format'

import type { Summary } from '../types'

type TakingsChartProps = {
  byPeriod: Summary['byPeriod']
}

/** "22/11" for a day, "nov. 2026" for a month. */
function bucketLabel(key: string, unit: 'day' | 'month', long = false) {
  if (unit === 'month') {
    const [year, month] = key.split('-').map(Number)
    return new Intl.DateTimeFormat(locale(), { month: long ? 'long' : 'short', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    )
  }
  const [year, month, day] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(
    locale(),
    long ? { weekday: 'short', day: 'numeric', month: 'long' } : { day: '2-digit', month: '2-digit' },
  ).format(new Date(year, month - 1, day))
}

/**
 * Bar takings per day (or per month, for a long period): one series, so no legend; the title names it.
 * Each bar shows its figures on hover or focus, and the same figures are in the table underneath.
 */
export function TakingsChart({ byPeriod }: TakingsChartProps) {
  const { unit, points } = byPeriod
  const [shown, setShown] = useState<number | null>(null)
  const highest = Math.max(0, ...points.map((p) => p.barCents))
  const active = shown === null ? null : points[shown]

  return (
    <section className="admin-card takings-chart" aria-labelledby="takings-title">
      <div className="takings-head">
        <div>
          <h3 id="takings-title" className="admin-card-title">
            {unit === 'day' ? t('Bar takings per day') : t('Bar takings per month')}
          </h3>
          <p className="admin-card-note">{t('In tokens, without deposits.')}</p>
        </div>
        {/* The readout: what the hovered or focused bar stands for. */}
        <p className="takings-readout" aria-live="polite">
          {active ? (
            <>
              <strong>{tokenPrice(active.barCents)}</strong>{' '}
              <span>
                {bucketLabel(active.key, unit, true)} · {t('{count} sales', { count: active.barSales })} ·{' '}
                {t('{amount} money in', { amount: money(active.moneyInCents) })}
              </span>
            </>
          ) : highest > 0 ? (
            <span>{t('Point at a bar for its figures.')}</span>
          ) : null}
        </p>
      </div>
      {highest === 0 ? (
        <p className="muted takings-empty">{t('No bar sales in this period.')}</p>
      ) : (
        <>
          <div className="takings-plot" onPointerLeave={() => setShown(null)}>
            <span className="takings-max">{tokenPrice(highest)}</span>
            <div className="takings-bars">
              {points.map((point, i) => (
                <button
                  key={point.key}
                  type="button"
                  className={shown === i ? 'takings-bar shown' : 'takings-bar'}
                  aria-label={`${bucketLabel(point.key, unit, true)}: ${tokenPrice(point.barCents)}`}
                  onPointerEnter={() => setShown(i)}
                  onFocus={() => setShown(i)}
                  onBlur={() => setShown(null)}
                >
                  {point.barCents > 0 && (
                    <span style={{ height: `${Math.max(2, (point.barCents / highest) * 100)}%` }} />
                  )}
                </button>
              ))}
            </div>
            <div className="takings-axis" aria-hidden="true">
              <span>{bucketLabel(points[0].key, unit)}</span>
              <span>{bucketLabel(points[points.length - 1].key, unit)}</span>
            </div>
          </div>
          <details className="takings-table">
            <summary>{t('Show as a table')}</summary>
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{unit === 'day' ? t('Day') : t('Month')}</th>
                  <th scope="col">{t('Bar takings')}</th>
                  <th scope="col">{t('Sales')}</th>
                  <th scope="col">{t('Money in')}</th>
                </tr>
              </thead>
              <tbody>
                {points
                  .filter((p) => p.barCents !== 0 || p.moneyInCents !== 0)
                  .map((p) => (
                    <tr key={p.key}>
                      <th scope="row">{bucketLabel(p.key, unit, true)}</th>
                      <td>{tokenPrice(p.barCents)}</td>
                      <td>{p.barSales}</td>
                      <td>{money(p.moneyInCents)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  )
}
