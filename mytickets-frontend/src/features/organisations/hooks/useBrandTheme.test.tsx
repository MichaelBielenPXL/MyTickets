import { waitFor } from '@testing-library/react'

import { HttpResponse, anOrganisation, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { useBrandTheme } from './useBrandTheme'

function Themed({ slug }: { slug: string }) {
  useBrandTheme(slug)
  return null
}

describe('useBrandTheme', () => {
  it("paints the page in the organisation's colour while inside it, and clears it on the way out", async () => {
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ brandColor: '#3d6b56' })),
      ),
    )
    const { unmount } = renderApp(<Themed slug="night-owls" />)
    const root = document.documentElement

    await waitFor(() => expect(root.style.getPropertyValue('--brand')).toBe('#3d6b56'))
    expect(root.style.getPropertyValue('--brand-ink')).toBe('#ffffff')
    expect(root).toHaveAttribute('data-org-brand')

    unmount()
    expect(root.style.getPropertyValue('--brand')).toBe('')
    expect(root).not.toHaveAttribute('data-org-brand')
  })
})
