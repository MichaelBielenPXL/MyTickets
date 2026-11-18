# MyTickets

Self-hosted ticketing for parties: organisations sell tickets, members keep a credit wallet per
organisation, and an NFC card linked to their account gets them in at the door and pays at the bar.

## Run it

You need the .NET 10 SDK, Node, and Docker (for Redis and RustFS).

    cd mytickets-backend/mytickets-backend
    dotnet run            # or run the AppHost from Rider

Then open http://localhost:5173. The Aspire host starts Redis, RustFS (picture storage), the API and the frontend together.
The first account you create can start an organisation and becomes its admin.

## What is where

- `mytickets-backend/mytickets-backend` – Aspire host that starts everything.
- `mytickets-backend/MyTickets.Api` – the API (.NET 10 minimal APIs, EF Core, SQLite, Redis cache).
  Data lives in `MyTickets.Api/data/` (change it with `Data:Folder`):
  - `platform.db` – the list of organisations and the organisers who own them. No guest data.
  - `organisations/<id>.db` – one database per organisation with everything that belongs to it:
    accounts, memberships, tickets, credit, cards, events, bar menu.
  Back up that folder and you have everything.
- `mytickets-backend/MyTickets.Tests` – end-to-end tests of the money and ticket flows (`dotnet test`).
- `mytickets-frontend` – React + TypeScript + Vite, laid out as reacthandbook.dev recommends:
  - `src/features/<feature>/` holds each area (`api` for server calls, `components`, `routes` for pages,
    `types`). Features use each other only through their `index.ts`; a lint rule enforces that.
  - `src/components`, `src/lib`, `src/utils`, `src/routes`, `src/providers` are shared by all features.
  - Server data goes through TanStack Query. Imports use the `@/` alias for `src/`.
  - `npm test` runs the component tests (Vitest, React Testing Library, MSW), `npm run lint` and
    `npm run format` check and tidy the code.

## Things to know

- **Every organisation is separate.** Accounts are not shared: someone who signs up at two
  organisations has two accounts, each with its own password, tickets, credit and cards, and the same
  card has to be linked at each. A browser can be signed in to several organisations at once.
- **Organisers are the exception.** Signing up on the front page creates an owner login plus a first
  organisation. That login (front page, "Log in") opens every organisation the owner created, and only
  an owner can add another one. Guests sign up and log in on the organisation's own page.

- **Pictures** (organisation logos, event pictures) are stored in RustFS, an S3-compatible store the
  Aspire host runs as a container with a named volume (`mytickets-images`). Its secret key is generated
  on first start and kept in the host project's user secrets. Run without the host, the API keeps
  pictures in an `uploaded-images` folder instead. For another S3-compatible store set
  `Storage:Endpoint`, `Storage:AccessKey`, `Storage:SecretKey` and `Storage:Bucket`.
- **The start page** opens in the organisation you used last on that device; the switcher top-left
  moves between your organisations.

- **Payments go through Stripe Connect.** Each organisation signs up once on Stripe's own pages
  (Manage › Payouts): its details, an ID and the bank account to be paid on. Buyers then pay on Stripe's
  page (Bancontact, card), the organisation is the seller, and Stripe pays it out automatically.
  Buyers pay into the platform's Stripe account; right after each payment the app reads what Stripe
  charged and transfers the rest to the organisation, minus the platform fee: 5% per ticket or top-up,
  at most €1.50 each (`Stripe:PlatformFeePercent`, `Stripe:PlatformFeeMaxCentsPerItem`), but never less
  than Stripe's cost plus €0.05 (`Stripe:MinimumMarginCents`), so no payment costs the platform money.
  Online payments start at €0.50, Stripe's minimum. Set the keys in the Aspire host's user secrets, in `mytickets-backend/mytickets-backend`:
  `dotnet user-secrets set Stripe:SecretKey sk_test_...` and `dotnet user-secrets set Stripe:WebhookSecret whsec_...`.
  The webhook is `/api/payments/stripe-webhook`; on a laptop, `stripe listen --forward-to
  localhost:5173/api/payments/stripe-webhook` prints the secret. Payments are also confirmed when the
  buyer comes back and by a check every minute. Without a key, a developer machine uses the test
  checkout (no money moves) and a live site refuses online payments.
- **Cards**: tapping works in Chrome on Android (Web NFC). Everywhere else staff type the card number.
  Phones only allow NFC and the camera on an `https://` address, so the real deployment needs HTTPS.
- **Who may become an organiser**: everyone, unless `Organisations:CreatorEmails` in the API settings
  lists the allowed email addresses.
- **Roles**: an admin sets members to Staff (door and bar) or Admin under Manage › Members.
- Redis only caches rarely-changing lists (organisations, bar menu). Balances and ticket counts always
  come straight from the database.
