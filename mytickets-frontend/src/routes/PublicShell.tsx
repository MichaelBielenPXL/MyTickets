import { Outlet } from 'react-router-dom'

import { AppHeader } from './AppHeader'

/** Frame around the pages anyone may see: an organisation's page and its events. */
export function PublicShell() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
