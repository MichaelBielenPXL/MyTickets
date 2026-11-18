import { useRef, useState } from 'react'

import { money } from '@/utils/format'
import { tileFill } from '@/utils/tileColors'

import type { MenuCategory, MenuProduct } from '../types'

type TillTilesProps = {
  items: MenuProduct[]
  /** Cups and other deposits: shown on every tab, to buy one on its own or take one back. */
  deposits: MenuProduct[]
  categories: MenuCategory[]
  counts: Record<string, number>
  /** Per deposit: cups bought on their own (positive) or taken back (negative). */
  cups: Record<string, number>
  onAdd: (productId: string) => void
  onRemove: (productId: string) => void
  onCups: (depositId: string, by: number) => void
}

const HOLD_MS = 450

/**
 * The coloured item tiles, under a tab per category. A tap adds one; holding a tile takes one off.
 * Items without a category go under "Other"; with no categories at all there are no tabs.
 */
export function TillTiles({
  items,
  deposits,
  categories,
  counts,
  cups,
  onAdd,
  onRemove,
  onCups,
}: TillTilesProps) {
  const tabs = [
    ...categories.filter((c) => items.some((p) => p.categoryId === c.id)),
    ...(items.some((p) => !categories.some((c) => c.id === p.categoryId)) && categories.length > 0
      ? [{ id: 'other', name: 'Other' }]
      : []),
  ]
  const [tab, setTab] = useState<string | null>(null)
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]
  const shown = !current
    ? items
    : current.id === 'other'
      ? items.filter((p) => !categories.some((c) => c.id === p.categoryId))
      : items.filter((p) => p.categoryId === current.id)

  return (
    <div className="till-menu">
      {tabs.length > 1 && (
        <div className="till-tabs" role="tablist" aria-label="Categories">
          {tabs.map((t) => {
            const inOrder = items
              .filter((p) =>
                t.id === 'other' ? !categories.some((c) => c.id === p.categoryId) : p.categoryId === t.id,
              )
              .reduce((n, p) => n + (counts[p.id] ?? 0), 0)
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === current?.id}
                className={t.id === current?.id ? 'till-tab active' : 'till-tab'}
                onClick={() => setTab(t.id)}
              >
                {t.name}
                {inOrder > 0 && <span className="till-tab-count">{inOrder}</span>}
              </button>
            )
          })}
        </div>
      )}
      {deposits.length > 0 && (
        <div className="till-cups" aria-label="Cups">
          {deposits.map((d) => {
            const adjusted = cups[d.id] ?? 0
            return (
              <div key={d.id} className="till-cup-pair">
                <button className="till-cup" onClick={() => onCups(d.id, 1)} aria-label={`Buy ${d.name}`}>
                  <strong>{d.name}</strong>
                  <span>+{money(d.priceCents)}</span>
                  {adjusted > 0 && <em aria-label={`${adjusted} bought`}>{adjusted}</em>}
                </button>
                <button
                  className="till-cup return"
                  onClick={() => onCups(d.id, -1)}
                  aria-label={`Return ${d.name}`}
                >
                  <strong>↩ Return {d.name}</strong>
                  <span>−{money(d.priceCents)}</span>
                  {adjusted < 0 && <em aria-label={`${-adjusted} returned`}>{-adjusted}</em>}
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div className="till-tiles">
        {shown.map((product) => (
          <Tile
            key={product.id}
            product={product}
            count={counts[product.id] ?? 0}
            onAdd={() => onAdd(product.id)}
            onRemove={() => onRemove(product.id)}
          />
        ))}
      </div>
    </div>
  )
}

type TileProps = {
  product: MenuProduct
  count: number
  onAdd: () => void
  onRemove: () => void
}

function Tile({ product, count, onAdd, onRemove }: TileProps) {
  const timer = useRef<number | null>(null)
  // Set when a hold took one off, so letting go doesn't add it straight back.
  const held = useRef(false)

  function press() {
    held.current = false
    timer.current = window.setTimeout(() => {
      held.current = true
      if (count > 0) {
        onRemove()
        navigator.vibrate?.(30)
      }
    }, HOLD_MS)
  }

  function release() {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <button
      className="till-tile"
      style={{ background: tileFill(product.color) }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) return
        onAdd()
      }}
    >
      <strong>{product.name}</strong>
      <span>{money(product.priceCents)}</span>
      {count > 0 && <em aria-label={`${count} in order`}>{count}</em>}
    </button>
  )
}
