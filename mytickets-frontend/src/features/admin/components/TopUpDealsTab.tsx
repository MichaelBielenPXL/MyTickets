import { type FormEvent, useState } from 'react'

import { ErrorNote, QueryResult } from '@/components'
import { t } from '@/lib/i18n'
import { euroInput, money, parseEuro, tokens } from '@/utils/format'

import { type TopUpDealInput, useSaveTopUpDeals, useTopUpDeals } from '../api/admin'

const MAX_DEALS = 8

type Row = { key: number; price: string; tokens: string }

/** Where an organisation sets its own token prices: pay this, get that many tokens. */
export function TopUpDealsTab({ slug }: { slug: string }) {
  const deals = useTopUpDeals(slug)
  return <QueryResult query={deals}>{(saved) => <DealsForm slug={slug} saved={saved} />}</QueryResult>
}

function DealsForm({ slug, saved }: { slug: string; saved: TopUpDealInput[] }) {
  const save = useSaveTopUpDeals(slug)
  const [rows, setRows] = useState<Row[]>(() =>
    saved.map((d, i) => ({
      key: i,
      price: euroInput(d.priceCents),
      tokens: d.tokensCents % 100 === 0 ? String(d.tokensCents / 100) : euroInput(d.tokensCents),
    })),
  )
  const [nextKey, setNextKey] = useState(saved.length)
  const [problem, setProblem] = useState('')

  function change(key: number, field: 'price' | 'tokens', value: string) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function add() {
    setRows((all) => [...all, { key: nextKey, price: '', tokens: '' }])
    setNextKey((k) => k + 1)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed: TopUpDealInput[] = []
    for (const row of rows) {
      const priceCents = parseEuro(row.price)
      const tokensCents = parseEuro(row.tokens)
      if (priceCents === null || tokensCents === null) {
        return setProblem(t('Fill in a price and a number of tokens for every top-up, like 5 and 6.'))
      }
      parsed.push({ priceCents, tokensCents })
    }
    setProblem('')
    save.mutate(parsed.sort((a, b) => a.priceCents - b.priceCents))
  }

  return (
    <form onSubmit={submit} className="panel stack topup-deals">
      <p className="muted">
        {t(
          'Members top up with these and only these. Give a bit extra to reward bigger top-ups. Without deals, members can top up any amount at one token per euro.',
        )}
      </p>

      {rows.length === 0 ? (
        <p className="topup-deals-empty">
          {t('No deals yet: members pick 10, 20, 40 or 60 tokens at one token per euro.')}
        </p>
      ) : (
        <ul className="topup-deals-list">
          {rows.map((row) => (
            <DealRow
              key={row.key}
              row={row}
              onChange={(field, value) => change(row.key, field, value)}
              onRemove={() => setRows((all) => all.filter((r) => r.key !== row.key))}
            />
          ))}
        </ul>
      )}

      {rows.length < MAX_DEALS && (
        <button type="button" className="btn" onClick={add}>
          {t('Add a top-up')}
        </button>
      )}

      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={save.error} />
      <div className="row">
        <button className="btn primary" disabled={save.isPending}>
          {save.isPending ? t('Saving…') : t('Save token prices')}
        </button>
        {save.isSuccess && (
          <span className="muted" role="status">
            {t('Saved.')}
          </span>
        )}
      </div>
    </form>
  )
}

function DealRow({
  row,
  onChange,
  onRemove,
}: {
  row: Row
  onChange: (field: 'price' | 'tokens', value: string) => void
  onRemove: () => void
}) {
  const priceCents = parseEuro(row.price)
  const tokensCents = parseEuro(row.tokens)
  const extra = priceCents !== null && tokensCents !== null ? tokensCents - priceCents : 0

  return (
    <li className="topup-deal-row">
      <label>
        <span>{t('Price in euro')}</span>
        <input
          inputMode="decimal"
          value={row.price}
          placeholder="5"
          onChange={(e) => onChange('price', e.target.value)}
        />
      </label>
      <span className="topup-deal-arrow" aria-hidden="true">
        →
      </span>
      <label>
        <span>{t('Tokens')}</span>
        <input
          inputMode="decimal"
          value={row.tokens}
          placeholder="6"
          onChange={(e) => onChange('tokens', e.target.value)}
        />
      </label>
      <span className="topup-deal-note">
        {priceCents !== null && tokensCents !== null
          ? extra > 0
            ? t('{price} for {tokens}: {extra} free', {
                price: money(priceCents),
                tokens: tokens(tokensCents),
                extra: tokens(extra),
              })
            : t('{price} for {tokens}', { price: money(priceCents), tokens: tokens(tokensCents) })
          : ''}
      </span>
      <button type="button" className="btn link danger" onClick={onRemove}>
        {t('Remove')}
      </button>
    </li>
  )
}
