# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Party and event organisers create organisations, publish events, set ticket capacity and membership access, and manage guests at the door.
- Guests join an organisation to buy tickets and use its organisation-specific credit wallet. They can link an NFC card to their account for entry and bar payments.

## Product Purpose

MyTickets is a ticketing platform for parties and events. It gives organisers tools to run events and gives guests an account for tickets, organisation memberships, and credit.

## Positioning

The owner is building MyTickets as an alternative to a ticketing service whose price they do not want to pay. Its confirmed product mechanism is organisation-scoped membership and credit, with an NFC card linked to a guest account.

## Operating Context

- Each organisation has a public page at `mytickets.be/{slug}` for guests to register or log in.
- Guests may belong to multiple organisations; credit belongs to a specific organisation.
- Organisers can manage multiple organisations after their first platform registration.
- A guest can link an NFC card to their account; the card can be scanned at the door and used for bar payments.

## Capabilities and Constraints

- Organisers create events with a fixed ticket inventory and can choose membership access types.
- Organiser registration currently creates the first organisation; its display name is required at signup and its description/image can be added later.
- Guest registration from an organisation page creates an account scoped to that organisation and does not automatically join a paid tier.
- Main-page event discovery across all organisations is undecided and not part of the current page request; guests are expected to follow an organisation page link.
- Who may create an organisation is still an open product decision.

## Brand Commitments

- The product name is MyTickets.
- Entrytickets' get-started and organisation pages, and Vercel's public marketing pages, are references for inspiration. MyTickets should keep its own identity and product language.

## Evidence on Hand

- A working React/TypeScript/Vite frontend and .NET API exist in this repository.
- Product flows for registration, organisations, events, tickets, credit wallets, and NFC cards are represented in the current codebase and integration tests.
- No customer logos, testimonials, adoption numbers, event photography, or performance claims were provided.

## Product Principles

- Keep guest experiences tied to the organisation they intend to join.
- Make organisation-specific balances and membership terms clear.
- Keep organiser and guest journeys understandable from the public organisation page.
- Do not invent customer proof, scale claims, or pricing promises.
