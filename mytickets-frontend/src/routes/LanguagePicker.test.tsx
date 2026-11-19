import { screen } from '@testing-library/react'

import { setLanguage } from '@/lib/i18n'
import { renderApp } from '@/test/render'

import { LanguagePicker } from './LanguagePicker'

afterEach(() => setLanguage('en'))

describe('LanguagePicker', () => {
  it('switches the app to Nederlands and remembers it', async () => {
    const { user } = renderApp(<LanguagePicker />)

    expect(screen.getByText('EN')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Language'), 'nl')

    expect(screen.getByText('NL')).toBeInTheDocument()
    expect(screen.getByLabelText('Taal')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('nl')
    expect(localStorage.getItem('mytickets:language')).toBe('nl')
  })
})
