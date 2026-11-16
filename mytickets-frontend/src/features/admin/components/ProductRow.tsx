import { useState } from 'react'

import { ErrorNote } from '@/components'
import { euroInput, parseEuro } from '@/utils/format'

import { useSaveProduct } from '../api/admin'
import type { Product } from '../types'

type ProductRowProps = {
  slug: string
  product: Product
}

/** One line of the bar menu: change the price, or take it off the menu and put it back. */
export function ProductRow({ slug, product }: ProductRowProps) {
  const [price, setPrice] = useState(euroInput(product.priceCents))
  const [problem, setProblem] = useState('')
  const save = useSaveProduct(slug)

  const typedCents = parseEuro(price)
  const priceChanged = typedCents !== product.priceCents

  function saveWith(changes: Partial<Product>) {
    if (typedCents === null) return setProblem('Enter prices like 12,50.')
    setProblem('')
    const { id, ...current } = product
    save.mutate({ id, product: { ...current, priceCents: typedCents, ...changes } })
  }

  return (
    <div className={product.active ? 'list-item' : 'list-item faded'}>
      <div>
        <strong>{product.name}</strong> {product.returnable && <span className="tag">Deposit</span>}
        {!product.active && <span className="tag">Off the menu</span>}
        <ErrorNote>{problem}</ErrorNote>
        <ErrorNote error={save.error} />
      </div>
      <div className="row">
        <input
          className="price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label={`Price of ${product.name}`}
        />
        {priceChanged && (
          <button className="btn primary small" disabled={save.isPending} onClick={() => saveWith({})}>
            Save
          </button>
        )}
        <button
          className="btn small"
          disabled={save.isPending}
          onClick={() => saveWith({ active: !product.active })}
        >
          {product.active ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
