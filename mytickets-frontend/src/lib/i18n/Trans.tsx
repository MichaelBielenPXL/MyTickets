import { Fragment, type ReactNode } from 'react'

import { t } from './language'

type TransProps = {
  /** The English sentence, with `{name}` where a value goes: "{org} approved {tier}." */
  text: string
  /** What goes in each place; can be markup, like a name in bold. */
  values: Record<string, ReactNode>
}

/**
 * A whole sentence translated at once, with markup inside it. Translating it in pieces would break in
 * Dutch, where the words around a name come in a different order.
 */
export function Trans({ text, values }: TransProps) {
  const parts = t(text).split(/(\{\w+\})/)
  return (
    <>
      {parts.map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1]
        return <Fragment key={i}>{name !== undefined && name in values ? values[name] : part}</Fragment>
      })}
    </>
  )
}
