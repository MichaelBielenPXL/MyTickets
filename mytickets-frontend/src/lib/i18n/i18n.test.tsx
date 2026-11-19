import { render, screen } from '@testing-library/react'

import { Trans } from './Trans'
import { setLanguage, t } from './language'
import { nl } from './nl'

afterEach(() => setLanguage('en'))

describe('t', () => {
  it('fills in values, in English and in Dutch', () => {
    expect(t('Pay {price} for {tokens}', { price: '€ 5,00', tokens: '6 tokens' })).toBe(
      'Pay € 5,00 for 6 tokens',
    )
    setLanguage('nl')
    expect(t('Pay {price} for {tokens}', { price: '€ 5,00', tokens: '6 tokens' })).toBe(
      'Betaal € 5,00 voor 6 tokens',
    )
  })

  it('shows the English when a text has no translation yet', () => {
    setLanguage('nl')
    expect(t('A sentence nobody translated')).toBe('A sentence nobody translated')
  })

  it("translates the server's fixed messages", () => {
    setLanguage('nl')
    expect(t('This card is blocked.')).toBe('Deze kaart is geblokkeerd.')
  })
})

describe('Trans', () => {
  it('keeps markup inside a translated sentence', () => {
    setLanguage('nl')
    render(<Trans text="Wants {tier}" values={{ tier: <strong>Premium</strong> }} />)
    expect(screen.getByText('Premium').tagName).toBe('STRONG')
    expect(document.body).toHaveTextContent('Wil Premium')
  })
})

/** Every text written as t('…') or <Trans text="…"> in the app has its Dutch. */
describe('Dutch dictionary', () => {
  const NOT_TRANSLATED = new Set(['#1c1c1e', 'MyTickets', 'UHasselt', 'Rechten'])

  // Every source file of the app, as text; tests and this folder left out.
  const sources = import.meta.glob(
    ['/src/**/*.{ts,tsx}', '!/src/**/*.test.*', '!/src/test/**', '!/src/lib/i18n/**'],
    {
      query: '?raw',
      import: 'default',
      eager: true,
    },
  ) as Record<string, string>

  it('has a translation for every text in the app', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    const missing = new Set<string>()
    const literal = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`
    const patterns = [
      new RegExp(String.raw`\bt\(\s*(?:${literal})`, 'g'),
      new RegExp(String.raw`<Trans\s+text=\{?\s*(?:${literal})`, 'g'),
    ]
    for (const code of Object.values(sources)) {
      for (const pattern of patterns) {
        for (const match of code.matchAll(pattern)) {
          const text = (match[1] ?? match[2]).replace(/\\(['"\\])/g, '$1')
          if (!(text in nl) && !NOT_TRANSLATED.has(text)) missing.add(text)
        }
      }
    }
    expect([...missing]).toEqual([])
  })
})
