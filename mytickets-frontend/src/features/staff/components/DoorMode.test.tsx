import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import type { StaffEvent } from '../types'
import { DoorMode } from './DoorMode'

const party: StaffEvent = { id: 'ev1', name: 'Party', startsAt: '2026-11-20T21:00:00Z', status: 'Upcoming' }

describe('DoorMode', () => {
  it('lets nobody in before the doors open, and opens them early when asked', async () => {
    let opened = false
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/events/ev1/open'), () => {
        opened = true
        return HttpResponse.json({ status: 'Open' })
      }),
      http.get(apiUrl('/orgs/night-owls/staff/context'), () => HttpResponse.json({})),
    )
    const { user } = renderApp(<DoorMode slug="night-owls" events={[party]} />)

    expect(screen.getByText('Not open yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan QR code' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open doors now' }))
    await vi.waitFor(() => expect(opened).toBe(true))
  })

  it('scans tickets while open, and asks before closing the event', async () => {
    const { user } = renderApp(<DoorMode slug="night-owls" events={[{ ...party, status: 'Open' }]} />)

    expect(screen.getByRole('button', { name: 'Scan QR code' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close event' }))
    expect(screen.getByRole('alertdialog', { name: 'Close Party?' })).toBeInTheDocument()
  })
})
