import { type FormEvent, useState } from 'react'

import { ErrorNote, Field, QueryResult, SortableList } from '@/components'
import { parseEuro } from '@/utils/format'

import { useCategories, useProducts, useReorderProducts, useSaveProduct } from '../api/admin'
import type { Category, Product } from '../types'
import { CategoriesPanel } from './CategoriesPanel'
import { CategoryChoice } from './CategoryChoice'
import { ColourPicker } from './ColourPicker'
import { DepositChoice } from './DepositChoice'
import { ProductRow } from './ProductRow'

type ProductsTabProps = {
  slug: string
}

/**
 * The bar menu, as the till shows it: drinks and food grouped by category (the till's tabs), then the
 * categories themselves, then the deposits (cups).
 */
export function ProductsTab({ slug }: ProductsTabProps) {
  const products = useProducts(slug)
  const categories = useCategories(slug)
  const reorder = useReorderProducts(slug)

  return (
    <QueryResult query={products}>
      {(list) => {
        const tabs = categories.data ?? []
        const deposits = list.filter((p) => p.isDeposit)
        const items = list.filter((p) => !p.isDeposit)
        const groups = groupByCategory(items, tabs)

        // A drag only moves items within one group; the order sent is every group's in turn.
        function reorderGroup(groupKey: string, ids: string[]) {
          const order = groups.flatMap((g) => (g.key === groupKey ? ids : g.items.map((p) => p.id)))
          reorder.mutate([...order, ...deposits.map((d) => d.id)])
        }

        return (
          <div className="stack">
            <section className="panel stack">
              <h2>Drinks and food</h2>
              <AddProduct slug={slug} kind="item" count={list.length} deposits={deposits} categories={tabs} />
            </section>
            <ErrorNote error={reorder.error} />
            {groups.map((group) => (
              <div key={group.key} className="stack menu-group">
                {tabs.length > 0 && <h3 className="menu-group-title">{group.name}</h3>}
                <SortableList
                  items={group.items}
                  nameOf={(product) => product.name}
                  onReorder={(ids) => reorderGroup(group.key, ids)}
                  renderItem={(product, handle) => (
                    <ProductRow
                      slug={slug}
                      product={product}
                      deposits={deposits}
                      categories={tabs}
                      handle={handle}
                    />
                  )}
                />
              </div>
            ))}
            {items.length === 0 && <p className="muted">Nothing on the menu yet.</p>}

            <CategoriesPanel slug={slug} categories={tabs} />

            <section className="panel stack">
              <div>
                <h2>Deposits</h2>
                <p className="muted">
                  A reusable cup, for example. The till charges it with every drink that comes with it, and a
                  &ldquo;returned&rdquo; button gives it back. Bringing back an empty cup for a new drink
                  costs nothing extra.
                </p>
              </div>
              {deposits.length > 0 && (
                <SortableList
                  items={deposits}
                  nameOf={(product) => product.name}
                  onReorder={(ids) => reorder.mutate([...items.map((p) => p.id), ...ids])}
                  renderItem={(product, handle) => (
                    <ProductRow
                      slug={slug}
                      product={product}
                      deposits={deposits}
                      categories={tabs}
                      handle={handle}
                    />
                  )}
                />
              )}
              <AddProduct
                slug={slug}
                kind="deposit"
                count={list.length}
                deposits={deposits}
                categories={tabs}
              />
            </section>
          </div>
        )
      }}
    </QueryResult>
  )
}

/** Items under each category in the categories' order, then the ones without a category under "Other". */
function groupByCategory(items: Product[], categories: Category[]) {
  const groups = categories.map((c) => ({
    key: c.id,
    name: c.name,
    items: items.filter((p) => p.categoryId === c.id),
  }))
  const known = new Set(categories.map((c) => c.id))
  const rest = items.filter((p) => !p.categoryId || !known.has(p.categoryId))
  return [...groups, { key: 'other', name: 'Other', items: rest }].filter((g) => g.items.length > 0)
}

type AddProductProps = {
  slug: string
  kind: 'deposit' | 'item'
  /** How many products there are, so a new one goes last. */
  count: number
  deposits: Product[]
  categories: Category[]
}

function AddProduct({ slug, kind, count, deposits, categories }: AddProductProps) {
  const isDeposit = kind === 'deposit'
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  // Most of a bar menu comes in a cup, so a new drink starts with the first one until someone picks
  // (undefined: not picked yet; null: picked "No deposit").
  const [depositId, setDepositId] = useState<string | null | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [problem, setProblem] = useState('')
  const add = useSaveProduct(slug)
  const chosenDeposit = depositId === undefined ? (deposits.find((d) => d.active)?.id ?? null) : depositId

  function submit(event: FormEvent) {
    event.preventDefault()
    const priceCents = parseEuro(price)
    if (priceCents === null) return setProblem('Enter prices like 12,50.')
    setProblem('')
    add.mutate(
      {
        product: {
          name,
          priceCents,
          active: true,
          sortOrder: count + 1,
          isDeposit,
          depositProductId: isDeposit ? null : chosenDeposit,
          categoryId: isDeposit ? null : categoryId,
          color: isDeposit ? null : color,
        },
      },
      {
        onSuccess: () => {
          setName('')
          setPrice('')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="stack add-product">
      <div className="grid-2">
        <Field label={isDeposit ? 'Deposit name' : 'Name'}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isDeposit ? 'Cup' : 'Beer'}
            required
            maxLength={80}
          />
        </Field>
        <Field label={isDeposit ? 'Deposit in euro' : 'Price in euro'}>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={isDeposit ? '1,00' : '2,50'}
            required
          />
        </Field>
        {!isDeposit && (
          <>
            <Field label="Category">
              <CategoryChoice categories={categories} value={categoryId} onChange={setCategoryId} />
            </Field>
            <Field label="Comes with">
              <DepositChoice deposits={deposits} value={chosenDeposit} onChange={setDepositId} />
            </Field>
          </>
        )}
      </div>
      {!isDeposit && <ColourPicker value={color} onChange={setColor} />}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={add.error} />
      <button className={isDeposit ? 'btn' : 'btn primary'} disabled={add.isPending}>
        {isDeposit ? 'Add deposit' : 'Add to the menu'}
      </button>
    </form>
  )
}
