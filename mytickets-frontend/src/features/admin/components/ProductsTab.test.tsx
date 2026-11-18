import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { ProductsTab } from './ProductsTab'

const cup = {
  id: 'cup',
  name: 'Cup',
  priceCents: 100,
  active: true,
  sortOrder: 1,
  isDeposit: true,
  depositProductId: null,
}
const cola = {
  id: 'cola',
  name: 'Cola',
  priceCents: 250,
  active: true,
  sortOrder: 2,
  isDeposit: false,
  depositProductId: 'cup',
}

describe('ProductsTab', () => {
  it('adds a drink in the first cup unless told otherwise', async () => {
    const sent: unknown[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/products'), () => HttpResponse.json([cup, cola])),
      http.post(apiUrl('/orgs/night-owls/admin/products'), async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ id: 'beer' })
      }),
    )
    const { user } = renderApp(<ProductsTab slug="night-owls" />)

    const drinks = (await screen.findByRole('heading', { name: 'Drinks and food' })).closest('section')!
    await user.type(within(drinks).getByLabelText('Name'), 'Beer')
    await user.type(within(drinks).getByLabelText('Price in euro'), '3,00')
    expect(within(drinks).getByLabelText('Comes with')).toHaveValue('cup')
    await user.click(within(drinks).getByRole('button', { name: 'Add to the menu' }))

    await vi.waitFor(() =>
      expect(sent[0]).toMatchObject({
        name: 'Beer',
        priceCents: 300,
        isDeposit: false,
        depositProductId: 'cup',
      }),
    )
    expect(screen.getByText('+ € 1,00 Cup')).toBeInTheDocument()
  })

  it('adds a deposit, which comes with nothing itself', async () => {
    const sent: unknown[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/products'), () => HttpResponse.json([])),
      http.post(apiUrl('/orgs/night-owls/admin/products'), async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ id: 'cup' })
      }),
    )
    const { user } = renderApp(<ProductsTab slug="night-owls" />)

    await user.type(await screen.findByLabelText('Deposit name'), 'Cup')
    await user.type(screen.getByLabelText('Deposit in euro'), '1')
    await user.click(screen.getByRole('button', { name: 'Add deposit' }))

    await vi.waitFor(() =>
      expect(sent[0]).toMatchObject({
        name: 'Cup',
        priceCents: 100,
        isDeposit: true,
        depositProductId: null,
      }),
    )
  })

  it('can add something that comes without a deposit', async () => {
    const sent: unknown[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/products'), () => HttpResponse.json([cup])),
      http.post(apiUrl('/orgs/night-owls/admin/products'), async ({ request }) => {
        sent.push(await request.json())
        return HttpResponse.json({ id: 'crisps' })
      }),
    )
    const { user } = renderApp(<ProductsTab slug="night-owls" />)

    const drinks = (await screen.findByRole('heading', { name: 'Drinks and food' })).closest('section')!
    await user.type(within(drinks).getByLabelText('Name'), 'Crisps')
    await user.type(within(drinks).getByLabelText('Price in euro'), '2')
    await user.selectOptions(within(drinks).getByLabelText('Comes with'), '')
    await user.click(within(drinks).getByRole('button', { name: 'Add to the menu' }))

    await vi.waitFor(() => expect(sent[0]).toMatchObject({ name: 'Crisps', depositProductId: null }))
  })

  it('edits an item: name, price and the cup it comes with', async () => {
    const sent: unknown[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/products'), () => HttpResponse.json([cup, cola])),
      http.put(apiUrl('/orgs/night-owls/admin/products/cola'), async ({ request }) => {
        sent.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp(<ProductsTab slug="night-owls" />)

    const row = (await screen.findByText('Cola')).closest('.list-item') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    const editor = screen.getByRole('form', { name: 'Edit Cola' })
    expect(within(editor).getByLabelText('Price in euro')).toHaveValue('2,50')
    await user.clear(within(editor).getByLabelText('Name'))
    await user.type(within(editor).getByLabelText('Name'), 'Coca-Cola')
    await user.clear(within(editor).getByLabelText('Price in euro'))
    await user.type(within(editor).getByLabelText('Price in euro'), '2,80')
    await user.selectOptions(within(editor).getByLabelText('Comes with'), '')
    await user.click(within(editor).getByRole('button', { name: 'Save' }))

    await vi.waitFor(() =>
      expect(sent[0]).toMatchObject({
        name: 'Coca-Cola',
        priceCents: 280,
        depositProductId: null,
        isDeposit: false,
      }),
    )
  })

  it('asks before deleting an item', async () => {
    let deleted = ''
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/products'), () => HttpResponse.json([cup, cola])),
      http.delete(apiUrl('/orgs/night-owls/admin/products/:id'), ({ params }) => {
        deleted = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp(<ProductsTab slug="night-owls" />)

    const row = (await screen.findByText('Cola')).closest('.list-item') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText(/Delete Cola\?/)).toBeInTheDocument()
    expect(deleted).toBe('')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(deleted).toBe('cola'))
  })

  it('gives every item a handle to drag it into place', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls/admin/products'), () => HttpResponse.json([cup, cola])))
    renderApp(<ProductsTab slug="night-owls" />)

    expect(await screen.findByRole('button', { name: 'Move Cola' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Cup' })).toBeInTheDocument()
  })
})
