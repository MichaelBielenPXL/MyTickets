import { money } from '@/utils/format'

/** "− € 0,62"; a plain "€ 0,00" when nothing came off. */
export const minus = (cents: number) => (cents > 0 ? `− ${money(cents)}` : money(0))
