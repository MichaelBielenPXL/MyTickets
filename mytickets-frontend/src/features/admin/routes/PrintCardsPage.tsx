import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useAdminCards, useCardDesign, useOrganisationSettings } from '../api/admin'
import { CardFace } from '../components/CardFace'
import { Segmented } from '../components/Segmented'

type Sides = 'both' | 'front' | 'back'

const SIDES: { value: Sides; label: string }[] = [
  { value: 'both', label: 'Both sides' },
  { value: 'front', label: 'Fronts only' },
  { value: 'back', label: 'Backs only' },
]

/**
 * The cards still to be printed, one credit-card-sized page (85.6 × 54 mm) per side, in the organisation's card
 * design; the back always has its name, the QR of the card's link and, small, its number. Both sides alternate, front
 * then back, for a printer that prints both sides; or one side at a time, for a printer that prints only one.
 * Print it straight to a card printer, or save it as a PDF for a print shop.
 */
export function PrintCardsPage() {
  const { slug = '' } = useParams()
  const cards = useAdminCards(slug)
  const settings = useOrganisationSettings(slug).data
  const design = useCardDesign(slug).data
  const [sides, setSides] = useState<Sides>('both')
  const shown = (['front', 'back'] as const).filter((side) => sides === 'both' || sides === side)

  return (
    <main className="print-cards">
      <QueryResult query={cards}>
        {(all) => {
          const toPrint = all.filter((card) => !card.uid && card.url).reverse()
          return (
            <>
              <header className="print-cards-bar">
                <Link to={`/${slug}/admin?tab=cards`} className="back">
                  {t('‹ Cards')}
                </Link>
                <p className="muted">
                  {t(
                    'Each side is its own page, the size of a bank card. Choose your card printer, or save as PDF.',
                  )}
                </p>
                <Segmented label={t('Sides to print')} options={SIDES} value={sides} onChange={setSides} />
                <button
                  className="btn primary"
                  disabled={toPrint.length === 0}
                  onClick={() => window.print()}
                >
                  {t('Print {count} cards', { count: toPrint.length })}
                </button>
              </header>
              {toPrint.length === 0 && <p className="muted">{t('Every card is already written.')}</p>}
              {settings &&
                design &&
                toPrint.flatMap((card) =>
                  shown.map((side) => (
                    <section key={`${card.id}-${side}`} className="print-card">
                      <CardFace
                        side={side}
                        design={design[side]}
                        organisationName={settings.name}
                        logoUrl={settings.logoUrl}
                        brandColor={settings.brandColor}
                        number={card.number}
                        url={card.url!}
                      />
                    </section>
                  )),
                )}
            </>
          )
        }}
      </QueryResult>
    </main>
  )
}
