import { type FormEvent, type ReactNode, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'
import { euroInput, money, parseEuro } from '@/utils/format'
import { tileFill } from '@/utils/tileColors'

import { useDeleteProduct, useSaveProduct } from '../api/admin'
import type { Category, Product } from '../types'
import { CategoryChoice } from './CategoryChoice'
import { ColourPicker } from './ColourPicker'
import { DepositChoice } from './DepositChoice'

type ProductRowProps = {
  slug: string
  product: Product
  /** The organisation's deposits, for choosing which one a drink comes with. */
  deposits: Product[]
  categories: Category[]
  /** The drag handle that moves the row. */
  handle: ReactNode
}

/** One line of the bar menu: move it, hide it, or open it to change or delete it. */
export function ProductRow({ slug, product, deposits, categories, handle }: ProductRowProps) {
  const [editing, setEditing] = useState(false)
  const save = useSaveProduct(slug)
  const deposit = deposits.find((d) => d.id === product.depositProductId)

  if (editing)
    return (
      <ProductEditor
        slug={slug}
        product={product}
        deposits={deposits}
        categories={categories}
        onDone={() => setEditing(false)}
      />
    )
  return (
    <div className={product.active ? 'list-item product-row' : 'list-item product-row faded'}>
      {handle}
      {!product.isDeposit && (
        <span className="tile-dot" style={{ background: tileFill(product.color) }} aria-hidden="true" />
      )}
      <div className="product-row-main">
        <strong>{product.name}</strong>
        <span className="product-row-price">{money(product.priceCents)}</span>
        {deposit && (
          <span className="tag">
            + {money(deposit.priceCents)} {deposit.name}
          </span>
        )}
        {!product.active && <span className="tag">{t('Hidden')}</span>}
        <ErrorNote error={save.error} />
      </div>
      <div className="row">
        <button
          className="btn small"
          disabled={save.isPending}
          onClick={() => {
            const { id, ...current } = product
            save.mutate({ id, product: { ...current, active: !product.active } })
          }}
        >
          {product.active ? t('Hide') : t('Show')}
        </button>
        <button className="btn small" onClick={() => setEditing(true)}>
          {t('Edit')}
        </button>
      </div>
    </div>
  )
}

type ProductEditorProps = {
  slug: string
  product: Product
  deposits: Product[]
  categories: Category[]
  onDone: () => void
}

function ProductEditor({ slug, product, deposits, categories, onDone }: ProductEditorProps) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(euroInput(product.priceCents))
  const [depositId, setDepositId] = useState(product.depositProductId)
  const [categoryId, setCategoryId] = useState(product.categoryId)
  const [color, setColor] = useState(product.color)
  const [problem, setProblem] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const save = useSaveProduct(slug)
  const remove = useDeleteProduct(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    const priceCents = parseEuro(price)
    if (priceCents === null) return setProblem(t('Enter prices like 12,50.'))
    setProblem('')
    const { id, ...current } = product
    save.mutate(
      {
        id,
        product: {
          ...current,
          name: name.trim(),
          priceCents,
          depositProductId: depositId,
          categoryId,
          color,
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="list-item product-editor stack" aria-label={`Edit ${product.name}`}>
      <div className="grid-2">
        <Field label={t('Name')}>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </Field>
        <Field label={product.isDeposit ? t('Deposit in euro') : t('Price in euro')}>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        {!product.isDeposit && (
          <>
            <Field label={t('Category')}>
              <CategoryChoice categories={categories} value={categoryId} onChange={setCategoryId} />
            </Field>
            <Field label={t('Comes with')}>
              <DepositChoice deposits={deposits} value={depositId} onChange={setDepositId} />
            </Field>
          </>
        )}
      </div>
      {!product.isDeposit && <ColourPicker value={color} onChange={setColor} />}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={save.error ?? remove.error} />
      {confirmingDelete ? (
        <div className="confirm-delete">
          <span>
            {t('Delete {name}? Past sales keep their history.', { name: product.name })}
            {product.isDeposit && ' ' + t('Cups still out can no longer be handed back for it.')}
          </span>
          <div className="row">
            <button
              type="button"
              className="btn danger small"
              disabled={remove.isPending}
              onClick={() => remove.mutate(product.id)}
            >
              {t('Delete')}
            </button>
            <button type="button" className="btn small" onClick={() => setConfirmingDelete(false)}>
              {t('Keep it')}
            </button>
          </div>
        </div>
      ) : (
        <div className="spread">
          <div className="row">
            <button className="btn primary small" disabled={save.isPending}>
              {t('Save')}
            </button>
            <button type="button" className="btn small" onClick={onDone}>
              {t('Cancel')}
            </button>
          </div>
          <button
            type="button"
            className="btn link danger-text small"
            onClick={() => setConfirmingDelete(true)}
          >
            {t('Delete')}
          </button>
        </div>
      )}
    </form>
  )
}
