import { Route, Routes } from 'react-router-dom'

import { AdminPage } from '@/features/admin'
import { AuthPage } from '@/features/auth'
import { CardsPage } from '@/features/cards'
import { EventPage } from '@/features/events'
import { HomePage, OrganisationPage, StartPage } from '@/features/organisations'
import { CheckoutPage } from '@/features/payments'
import { StaffPage } from '@/features/staff'
import { TicketsPage } from '@/features/tickets'
import { WalletPage } from '@/features/wallet'

import { AppShell } from './AppShell'
import { LegacyOrganisationRedirect } from './LegacyOrganisationRedirect'
import { NotFoundPage } from './NotFoundPage'
import { PublicShell } from './PublicShell'
import { SignedOutOnly } from './SignedOutOnly'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route path="/:slug/login" element={<AuthPage key="org-login" mode="login" />} />
        <Route path="/:slug/register" element={<AuthPage key="org-register" mode="register" />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="/" element={<StartPage />} />
        <Route path="/discover" element={<HomePage />} />
        <Route path="/:slug/tickets" element={<TicketsPage />} />
        <Route path="/:slug/cards" element={<CardsPage />} />
        <Route path="/:slug/checkout/:paymentId" element={<CheckoutPage />} />
        <Route path="/:slug/wallet" element={<WalletPage />} />
        <Route path="/:slug/staff" element={<StaffPage />} />
        <Route path="/:slug/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<PublicShell />}>
        <Route path="/:slug" element={<OrganisationPage />} />
        <Route path="/:slug/events/:eventId" element={<EventPage />} />
      </Route>
      <Route path="/o/:slug/*" element={<LegacyOrganisationRedirect />} />
    </Routes>
  )
}
