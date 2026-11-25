export interface LegalSection {
  heading: string
  /** Paragraphs; a paragraph that is an array is a bulleted list. */
  body: (string | string[])[]
}

export interface LegalDocument {
  title: string
  intro: string
  sections: LegalSection[]
}

/**
 * The version people agree to when they create an account. The server stores it with the account
 * (Legal.TermsVersion in the API): change both together whenever the text changes in substance.
 */
export const TERMS_VERSION = '2026-11-21'

/** Who runs MyTickets and how to reach them. Fill in before going live. */
export const OPERATOR = {
  name: 'MyTickets',
  contactEmail: 'privacy@mytickets.be',
}
