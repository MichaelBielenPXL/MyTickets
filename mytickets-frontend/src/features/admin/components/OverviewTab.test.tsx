import { screen, within } from '@testing-library/react'

import { HttpResponse, aSummary, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { periodOf } from '../utils/period'
import { OverviewTab } from './OverviewTab'

describe('OverviewTab', () => {
  it('shows what the organisation gets paid, with every fee taken off', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls/admin/summary'), () => HttpResponse.json(aSummary())))
    renderApp(<OverviewTab slug="night-owls" />)

    const online = within(
      (await screen.findByText('You get from online payments')).closest('dl') as HTMLElement,
    )
    expect(online.getByText(/33,63/)).toBeInTheDocument()

    const money = within(screen.getByRole('region', { name: 'What you get paid' }))
    const membership = within(money.getByRole('row', { name: /^Memberships/ }))
    // €25 paid, €1.25 MyTickets fee, €2 for the month's payout account: €21.75 is the organisation's.
    expect(membership.getByText(/25,00/)).toBeInTheDocument()
    expect(membership.getByText(/− €\s?1,25/)).toBeInTheDocument()
    expect(membership.getByText(/− €\s?2,00/)).toBeInTheDocument()
    expect(membership.getByText(/21,75/)).toBeInTheDocument()
    // Online after fees plus the cash: €33.63 + €10.
    expect(within(money.getByRole('row', { name: /^Total/ })).getByText(/43,63/)).toBeInTheDocument()

    // Stripe's payouts to the bank, with the fee on each and what is still to come off.
    const bank = within(screen.getByRole('region', { name: 'Payouts to your bank' }))
    // €0.35 for the payout, plus the month's €2 as it was the first this month.
    expect(bank.getByText(/100,00 · fee €\s?2,35/)).toBeInTheDocument()
    // Paid from the buffer set aside for it; what's left of the buffer is shown.
    expect(
      within(bank.getByText('Buffer for your next payouts').parentElement!).getByText(/0,15/),
    ).toBeInTheDocument()

    // Every payment, one by one.
    const payments = within(screen.getByRole('region', { name: 'Payments' }))
    expect(payments.getByRole('row', { name: /Member membership/ })).toHaveTextContent(/21,75/)
  })

  it('asks for the chosen period', async () => {
    const asked: string[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/summary'), ({ request }) => {
        asked.push(new URL(request.url).search)
        return HttpResponse.json(aSummary())
      }),
    )
    const { user } = renderApp(<OverviewTab slug="night-owls" />)

    const month = periodOf('month')
    await vi.waitFor(() => expect(asked).toEqual([`?from=${month.from}&to=${month.to}`]))
    await user.click(screen.getByRole('radio', { name: 'All time' }))
    await vi.waitFor(() => expect(asked).toContain(''))
  })

  it('shows each bar day on hover and as a table', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls/admin/summary'), () => HttpResponse.json(aSummary())))
    const { user } = renderApp(<OverviewTab slug="night-owls" />)

    const chart = within(await screen.findByRole('region', { name: 'Bar takings per day' }))
    await user.hover(chart.getByRole('button', { name: /22 November: T 340,50/ }))
    expect(chart.getByText('12 sales', { exact: false })).toBeInTheDocument()

    await user.click(chart.getByText('Show as a table'))
    expect(chart.getByRole('row', { name: /22 November/ })).toHaveTextContent('T 340,50')
  })

  it('works out the periods on the local calendar', () => {
    const today = new Date(2026, 0, 15)
    expect(periodOf('month', today)).toEqual({ from: '2026-01-01', to: '2026-01-15' })
    expect(periodOf('lastMonth', today)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodOf('year', today)).toEqual({ from: '2026-01-01', to: '2026-01-15' })
    expect(periodOf('all', today)).toEqual({})
  })
})
