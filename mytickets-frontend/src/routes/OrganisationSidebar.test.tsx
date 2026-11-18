import { screen } from '@testing-library/react'

import { renderApp } from '@/test/render'

import { OrganisationSidebar } from './OrganisationSidebar'

describe('OrganisationSidebar', () => {
  it('folds Manage out into its sections while an admin is in Manage', () => {
    renderApp(<OrganisationSidebar slug="night-owls" hasAccount role="Admin" />, {
      at: '/night-owls/admin?tab=members',
      path: '/:slug/admin',
    })

    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/night-owls/admin')
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Bar menu' })).toHaveAttribute(
      'href',
      '/night-owls/admin?tab=bar',
    )
  })

  it('names the event work after the role, and shows no Manage to others', () => {
    renderApp(<OrganisationSidebar slug="night-owls" hasAccount role="Barman" />, {
      at: '/night-owls',
      path: '/:slug',
    })

    expect(screen.getByRole('link', { name: 'Bar' })).toHaveAttribute('href', '/night-owls/staff')
    expect(screen.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument()
  })
})
