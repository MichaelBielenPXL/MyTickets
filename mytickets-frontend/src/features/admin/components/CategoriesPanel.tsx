import { type FormEvent, useState } from 'react'

import { ErrorNote, SortableList } from '@/components'
import { t } from '@/lib/i18n'

import { useDeleteCategory, useReorderCategories, useSaveCategory } from '../api/admin'
import type { Category } from '../types'

type CategoriesPanelProps = {
  slug: string
  categories: Category[]
}

/** The tabs across the top of the till. Without any, the till shows every item on one page. */
export function CategoriesPanel({ slug, categories }: CategoriesPanelProps) {
  const [name, setName] = useState('')
  const add = useSaveCategory(slug)
  const reorder = useReorderCategories(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    add.mutate({ name }, { onSuccess: () => setName('') })
  }

  return (
    <section className="panel stack">
      <div>
        <h2>{t('Categories')}</h2>
        <p className="muted">
          {t(
            'Tabs across the top of the till, such as Beer, Soft drinks and Food. Drag them into the order you want.',
          )}
        </p>
      </div>
      {categories.length > 0 && (
        <SortableList
          items={categories}
          nameOf={(c) => c.name}
          onReorder={(ids) => reorder.mutate(ids)}
          renderItem={(category, handle) => <CategoryRow slug={slug} category={category} handle={handle} />}
        />
      )}
      <ErrorNote error={reorder.error} />
      <form onSubmit={submit} className="row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Beer')}
          aria-label={t('New category')}
          required
          maxLength={80}
        />
        <button className="btn" disabled={add.isPending}>
          {t('Add category')}
        </button>
      </form>
      <ErrorNote error={add.error} />
    </section>
  )
}

type CategoryRowProps = {
  slug: string
  category: Category
  handle: React.ReactNode
}

function CategoryRow({ slug, category, handle }: CategoryRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [confirming, setConfirming] = useState(false)
  const save = useSaveCategory(slug)
  const remove = useDeleteCategory(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ id: category.id, name }, { onSuccess: () => setEditing(false) })
  }

  return (
    <div className="list-item product-row">
      {handle}
      <div className="product-row-main">
        {editing ? (
          <form onSubmit={submit} className="row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t('Name of {name}', { name: category.name })}
              required
              maxLength={80}
            />
            <button className="btn primary small" disabled={save.isPending}>
              {t('Save')}
            </button>
            <button type="button" className="btn small" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </button>
          </form>
        ) : (
          <strong>{category.name}</strong>
        )}
        {confirming && (
          <div className="confirm-delete">
            <span>
              {t('Delete {name}? Its items stay on the menu, under Other.', { name: category.name })}
            </span>
            <div className="row">
              <button
                className="btn danger small"
                disabled={remove.isPending}
                onClick={() => remove.mutate(category.id)}
              >
                {t('Delete')}
              </button>
              <button className="btn small" onClick={() => setConfirming(false)}>
                {t('Keep it')}
              </button>
            </div>
          </div>
        )}
        <ErrorNote error={save.error ?? remove.error} />
      </div>
      {!editing && !confirming && (
        <div className="row">
          <button
            className="btn small"
            onClick={() => setEditing(true)}
            aria-label={t('Rename {name}', { name: category.name })}
          >
            {t('Rename')}
          </button>
          <button
            className="btn link danger-text small"
            onClick={() => setConfirming(true)}
            aria-label={t('Delete {name}', { name: category.name })}
          >
            {t('Delete')}
          </button>
        </div>
      )}
    </div>
  )
}
