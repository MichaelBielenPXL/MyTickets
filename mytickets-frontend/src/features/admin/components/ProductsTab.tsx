import { type FormEvent, useState } from 'react'

import { ErrorNote, Field, QueryResult } from '@/components'
import { parseEuro } from '@/utils/format'

import { useProducts, useSaveProduct } from '../api/admin'
import { ProductRow } from './ProductRow'

type ProductsTabProps = {
  slug: string
}

export function ProductsTab({ slug }: ProductsTabProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [returnable, setReturnable] = useState(false)
  const [problem, setProblem] = useState('')
  const products = useProducts(slug)
  const add = useSaveProduct(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    const priceCents = parseEuro(price)
    if (priceCents === null) return setProblem('Enter prices like 12,50.')
    setProblem('')
    const sortOrder = (products.data?.length ?? 0) + 1
    add.mutate(
      { product: { name, priceCents, active: true, sortOrder, returnable } },
      {
        onSuccess: () => {
          setName('')
          setPrice('')
          setReturnable(false)
        },
      },
    )
  }

  return (
    <div className="stack">
      <form onSubmit={submit} className="panel stack">
        <h2>Add a product</h2>
        <div className="grid-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Beer"
              required
              maxLength={80}
            />
          </Field>
          <Field label="Price in euro">
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2,50"
              required
            />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={returnable} onChange={(e) => setReturnable(e.target.checked)} />
          Deposit: guests get this back as credit when they return it (a reusable cup, for example)
        </label>
        <ErrorNote>{problem}</ErrorNote>
        <ErrorNote error={add.error} />
        <button className="btn primary" disabled={add.isPending}>
          Add
        </button>
      </form>
      <QueryResult query={products}>
        {(list) => (
          <>
            <div className="list">
              {list.map((product) => (
                <ProductRow key={product.id} slug={slug} product={product} />
              ))}
            </div>
            {list.length === 0 && <p className="muted">Nothing on the menu yet.</p>}
          </>
        )}
      </QueryResult>
    </div>
  )
}
