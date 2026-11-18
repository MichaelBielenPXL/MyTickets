# Ticketing Platform Redesign

## Product & UX/UI Design Specification

**Document type:** Product design brief / UX specification\
**Status:** Initial redesign direction\
**Version:** 1.0\
**Date:** 17 November 2026\
**Audience:** Product, design, engineering, operations, marketing and
event organisers

------------------------------------------------------------------------

## 1. Executive summary

This document defines a redesign direction for an existing
event-ticketing platform. The goal is not simply to make the interface
look newer. The redesign should make the platform easier to buy from,
easier to operate, and more effective at helping organisers grow and
manage events.

The product serves two connected but distinct audiences:

1.  **Ticket buyers** need a fast, trustworthy, mobile-first purchase
    journey.
2.  **Event organisers and their teams** need a dependable workspace to
    configure events, sell tickets, understand performance and manage
    entry.

The proposed experience has three connected surfaces:

-   **Public ticket shop:** branded, conversion-focused and responsive.
-   **Organiser dashboard:** a clear command centre for event setup,
    sales, customers, marketing and operations.
-   **On-site entry experience:** a fast, resilient scanning and
    attendance workflow for event-day teams.

The design should combine the best general patterns associated with
modern ticketing products---simple checkout, flexible event branding,
queue and capacity management, promoter attribution, guestlist workflows
and operational analytics---without copying another platform's interface
or assuming that every competitor feature is suitable for this product.

### Product vision

> Make discovering, buying, managing and validating event tickets feel
> effortless---for attendees and organisers alike.

### Primary outcomes

-   Increase ticket-shop conversion.
-   Reduce checkout abandonment and support requests.
-   Reduce the time required to create and publish an event.
-   Give organisers a reliable, understandable view of sales and event
    health.
-   Make event-day entry faster and more resilient.
-   Create a coherent visual experience across the buyer, organiser and
    scanning surfaces.

------------------------------------------------------------------------

## 2. Context, assumptions and scope

This is a strategic starting point, not a record of an audited existing
product. The current platform's analytics, technical architecture, user
research, feature set and commercial model have not been supplied.

### Working assumptions

-   The platform already supports at least basic event creation and
    ticket sales.
-   Events may include festivals, club nights, concerts, conferences and
    other ticketed experiences.
-   The platform serves a European audience; local payment methods, tax
    requirements and privacy obligations therefore matter.
-   Organisers may range from first-time promoters to teams managing
    multiple events.
-   Many buyers arrive from a mobile link shared through social media or
    messaging apps.
-   Some features described below may already exist. In that case, the
    redesign should improve their usability rather than duplicate them.

### In scope

-   Information architecture and navigation.
-   Public event pages and ticket-shop experience.
-   Ticket selection, checkout and confirmation.
-   Organiser onboarding and event creation.
-   Event dashboard and sales analytics.
-   Ticket types, capacity, add-ons and promotions.
-   Orders, attendees, guestlists and refunds.
-   Promoter / ambassador tracking.
-   Event-day scanning and entry management.
-   Design system, accessibility, responsive behaviour and measurement.

### Out of scope for the first release

-   Rebuilding the payment-processing infrastructure.
-   Replacing accounting or enterprise resource planning systems.
-   Building a social network or full event-discovery marketplace.
-   Implementing complex dynamic pricing before basic pricing and
    inventory are dependable.
-   Replacing all existing integrations without evidence that they are
    causing user problems.

------------------------------------------------------------------------

## 3. Product principles

These principles should guide design decisions and resolve trade-offs.

### 3.1 Conversion without pressure

Make the next step obvious, disclose the full cost early, and
communicate availability honestly. Avoid deceptive urgency, hidden fees
or manipulative countdowns.

### 3.2 Event brand first

The ticket shop should feel like an extension of the event's identity.
Organisers should be able to customise imagery, colour and selected
content while the platform protects legibility, accessibility and
checkout consistency.

### 3.3 Progressive disclosure

Show essential information first. Reveal advanced configuration when it
is relevant, rather than overwhelming new organisers with every setting
at once.

### 3.4 One source of truth

Ticket availability, order status, attendee data and scan status should
remain consistent across the shop, dashboard and scanning app.

### 3.5 Mobile is a primary experience

Design buyer journeys for small screens first. The organiser dashboard
should also be responsive, while prioritising efficient desktop
workflows for complex administration.

### 3.6 Operational clarity

Make important states visible: draft, on sale, paused, sold out, low
stock, cancelled, refunded, checked in and offline.

### 3.7 Trust is part of the interface

Show clear organiser identity, event details, payment reassurance,
refund terms, privacy information and support routes at the moments
people need them.

------------------------------------------------------------------------

## 4. Audiences and jobs to be done

### 4.1 Ticket buyer

**Goal:** Buy the correct ticket quickly and feel confident that the
purchase succeeded.

Needs: - Understand what the event is, when and where it happens. -
Compare ticket types and prices. - Know what is included and what is
excluded. - Complete checkout on mobile. - Receive and retrieve a valid
ticket. - Find event updates and support.

Pain points to investigate: - Unclear ticket differences. - Unexpected
fees late in checkout. - Too many required fields. - Payment failures
with no recovery path. - Confirmation emails that are hard to find. -
Confusing QR-code or ticket-transfer rules.

### 4.2 Event organiser / promoter

**Goal:** Set up an event, sell tickets and run it successfully.

Needs: - Publish an event without specialist training. - Configure
ticket types, quantities, prices and sales periods. - Monitor revenue,
sales pace and remaining capacity. - Understand where sales come from. -
Resolve customer and order issues. - Coordinate staff, guestlists and
entry.

### 4.3 Event operations manager

**Goal:** Keep event-day operations moving and maintain accurate
attendance information.

Needs: - See valid tickets and their status. - Scan quickly, including
in poor connectivity. - Prevent duplicate entry. - Resolve exceptions. -
Monitor attendance and entry rates. - Reconcile devices and scan
activity.

### 4.4 Promoter / ambassador

**Goal:** Share a trackable link or code and understand the results.

Needs: - Access a unique referral link or code. - See attributed sales
and commission rules. - Understand performance and payout status. -
Avoid access to unnecessary customer information.

### 4.5 Finance / administration

**Goal:** Reconcile ticket revenue and handle financial administration
accurately.

Needs: - Understand gross sales, fees, refunds and net amounts. - Export
consistent reports. - Access invoices and payout information. - Track
refunds and adjustments. - Support relevant local invoicing
requirements.

------------------------------------------------------------------------

## 5. Information architecture

Use a consistent top-level structure. Avoid making every feature a
permanent navigation item.

### Organiser application

**Global navigation** - Overview - Events - Orders - Customers -
Marketing - Reports - Settings

**Event workspace** - Overview - Event page - Tickets & pricing -
Add-ons - Orders - Attendees - Guestlist - Promoters - Marketing - Entry
& scanning - Reports - Event settings

The event workspace should always display the event name and status. A
clear event switcher should allow users managing multiple events to move
between them.

### Buyer-facing structure

-   Event landing page
-   Ticket selection
-   Checkout
-   Order confirmation
-   Ticket wallet / ticket detail
-   Event information and help

### Navigation rules

-   Keep global account settings separate from event-specific settings.
-   Put high-frequency tasks near the top.
-   Use contextual tabs inside an event rather than a deep maze of
    nested pages.
-   Preserve filters and search state when users navigate back from an
    order or attendee detail.
-   Use breadcrumbs where hierarchy is not obvious.

------------------------------------------------------------------------

## 6. Buyer experience: public event page and ticket shop

### 6.1 Event landing page

The page should answer five questions immediately:

1.  What is the event?
2.  When is it?
3.  Where is it?
4.  What does it cost?
5.  How do I get tickets?

**Recommended content hierarchy** 1. Event artwork or hero image. 2.
Event name. 3. Date, time and venue. 4. Short description. 5. Primary
CTA: "Get tickets". 6. Ticket availability or sales status. 7. Line-up /
programme / key highlights. 8. Practical information: age limits,
accessibility, transport, entry rules. 9. Organiser identity and
support. 10. Refund, transfer and privacy information.

On mobile, keep the main purchase action easy to reach without covering
important content. A sticky bottom CTA may be appropriate, provided it
does not obscure content or assistive technology focus.

### 6.2 Ticket selection

Each ticket option should show: - Ticket name. - Price, including any
mandatory fees or a clear explanation of fees. - Sales window. -
Availability state. - What is included. - Restrictions or eligibility. -
Quantity selector.

Recommended ticket states: - Available - Low availability (only when
based on a reliable threshold) - Not yet on sale - Sales ended - Sold
out - Hidden / unavailable

Do not use a low-stock message unless inventory data supports it. Avoid
fake scarcity.

**Interaction** - Selecting a ticket updates the order summary
immediately. - Quantity controls support touch, keyboard and screen
readers. - The user can understand the maximum purchase quantity. - If a
ticket becomes unavailable during selection, explain what happened and
offer valid alternatives. - Keep the total visible as the user
progresses.

### 6.3 Add-ons and upgrades

Offer optional products after the main ticket decision or in a clearly
separated section: - Parking - Camping - Shuttle - Locker -
Merchandise - Food or drink vouchers - VIP upgrades

Rules: - Add-ons must be clearly optional. - Show price and key
conditions. - Do not preselect paid extras. - Explain whether an add-on
requires a particular ticket. - Make removal easy.

### 6.4 Checkout

Aim for a short, predictable checkout.

**Suggested sequence** 1. Contact details. 2. Required attendee details,
if necessary. 3. Optional add-ons. 4. Order review and transparent fee
breakdown. 5. Payment. 6. Confirmation.

The sequence may be compressed into one page if usability testing
supports it. Do not force account creation for a basic purchase unless
there is a strong operational reason.

**Form design** - Ask only for information that has a clear purpose. -
Label fields persistently; do not rely on placeholders. - Explain why
sensitive or unusual information is required. - Validate inline and
preserve entered information after recoverable errors. - Support
autofill and appropriate mobile keyboards. - Clearly distinguish
required and optional fields.

**Order summary** - Ticket names and quantities. - Subtotals. - Fees and
taxes, where applicable. - Discounts. - Add-ons. - Final amount due. -
Currency.

**Payment states** - Ready to pay - Processing - Successful - Declined -
Timed out - Cancelled - Unknown / needs verification

For an uncertain payment result, do not tell the buyer to pay again
immediately. First check the order/payment state or provide a safe
recovery route to prevent duplicate charges.

### 6.5 Confirmation and ticket delivery

After successful payment: - Show a clear success state and order
reference. - Explain where tickets have been sent. - Provide a direct
way to view or save tickets. - Show event date, venue and key entry
instructions. - Explain transfer, resale or name-change rules. - Provide
a support route.

Tickets should be easy to retrieve from email and, where supported, a
web wallet or mobile wallet. The QR code should be clear, sufficiently
sized and not obscured by decorative artwork.

------------------------------------------------------------------------

## 7. Organiser experience

### 7.1 Onboarding

The first session should help a new organiser reach a meaningful outcome
quickly.

Recommended onboarding: 1. Create account / sign in. 2. Choose organiser
or organisation name. 3. Create first event. 4. Add title, date, venue
and event image. 5. Create first ticket type. 6. Configure payment and
required legal details. 7. Preview the shop. 8. Publish or save as
draft.

Use a checklist with clear progress and the ability to leave and return.
Avoid blocking event creation on optional advanced configuration.

### 7.2 Event creation

Use a guided flow with autosave and a persistent preview.

**Step 1: Basics** - Event name - Event category - Description - Date
and time - Time zone - Venue / address - Event image

**Step 2: Tickets** - Ticket name - Price - Quantity / capacity - Sales
start and end - Per-order limits - Ticket visibility - Fees and tax
configuration

**Step 3: Shop design** - Theme / brand colour - Logo - Cover image -
Custom content blocks - Preview on desktop and mobile

**Step 4: Checkout** - Required buyer fields - Attendee fields - Terms
and conditions - Payment methods - Confirmation email content

**Step 5: Review** - Validation checklist - Preview - Publish
confirmation

The platform should identify missing critical settings before
publication and explain how to fix them.

### 7.3 Event overview dashboard

The overview is the organiser's command centre. It should answer: "How
is this event doing, and what needs my attention?"

**Primary KPI cards** - Tickets sold - Gross ticket revenue - Net
revenue or estimated payout (clearly labelled) - Remaining capacity -
Orders - Refunds

**Performance visualisation** - Sales over time. - Sales by ticket
type. - Sales by channel / promoter, if attribution is enabled. - Sales
compared with capacity. - Sales pace compared with a previous period or
target.

**Action / alert area** - Event not published. - Ticket sales not
started. - Low inventory. - Event nearing capacity. - Payment
configuration incomplete. - Unresolved payment or refund issues. - Event
date approaching. - Scanning devices not synced, where applicable.

Every metric must have a definition, time range and timezone. Avoid
ambiguous labels such as "Revenue" without explaining whether it means
gross, net, paid, refunded or estimated.

### 7.4 Tickets and pricing management

Organisers should be able to: - Create, edit, duplicate and archive
ticket types. - Set quantities and sales windows. - Set per-order
minimum and maximum quantities. - Configure hidden or access-code ticket
types. - Create group or multi-day passes, if supported. - Manage price
tiers such as Early Bird, Regular and VIP. - View sold, reserved,
available and refunded quantities separately.

**Inventory safeguards** - Prevent overselling. - Explain how temporary
checkout reservations affect availability. - Warn before reducing
capacity below the number already sold or reserved. - Record who changed
price, quantity or availability and when. - Confirm high-impact changes.

### 7.5 Orders and customer support

Order list features: - Search by order number, buyer email or attendee
name. - Filter by event, status, ticket type, date and payment status. -
Sort by purchase date and amount. - Export according to role
permissions.

Order detail: - Buyer and attendee details. - Items and quantities. -
Payment and refund status. - Fees, tax and total. - Ticket identifiers
and scan status. - Change history. - Support notes, where appropriate.

Actions should be permission-aware and clearly confirm irreversible or
financial changes.

### 7.6 Attendees and guestlists

Attendee management should support: - Search and filters. - Custom
attendee fields. - Import / export with validation. - Guestlist
categories such as artist, staff, sponsor, media and VIP. - Ticket
assignment. - Check-in status. - Duplicate detection. - Change history.

Do not expose attendee information to promoters or staff unless their
role requires it.

### 7.7 Promoters and ambassadors

Promoter management should provide: - Unique tracking links and/or
discount codes. - Attribution rules. - Sales and revenue by promoter. -
Commission configuration. - Commission status and payout history. -
Campaign start/end dates. - Exportable performance reports.

Clearly explain attribution: for example, whether a sale is credited to
the last click, a code used at checkout or another defined rule. Avoid
promising accurate attribution where browser privacy or tracking
limitations prevent it.

Promoters should have a restricted portal with only the information they
need. They should not automatically receive buyer contact details.

### 7.8 Marketing tools

Potential capabilities: - Discount codes. - Access codes. - Campaign
links and UTM parameters. - Referral / ambassador links. - Email
audience exports with consent controls. - Sales-source reporting. -
Abandoned-checkout insights, where privacy and technical rules permit.

Marketing features should not encourage unsolicited messaging. Respect
consent, unsubscribe and data-protection requirements.

### 7.9 Reports and finance

Reports should distinguish: - Gross ticket sales. - Discounts. - Fees. -
Taxes. - Refunds. - Chargebacks. - Net amount. - Payouts and payout
status.

Provide filters by event, period, ticket type and sales source. Exports
should include generation time, timezone, currency and column
definitions.

For Belgian and other European operations, validate invoicing, VAT,
Peppol and accounting requirements with qualified finance/legal
stakeholders before promising compliance. Treat local integrations as a
product capability that requires ongoing maintenance.

------------------------------------------------------------------------

## 8. Event-day entry and scanning

Entry is a high-pressure environment. Optimise for speed, clarity and
recovery rather than visual novelty.

### Core scanning screen

Show: - Large scan target / camera view. - Clear scan result. - Event
and gate context. - Connection / sync status. - Recent scans. - Manual
lookup fallback.

### Scan outcomes

**Valid** - Strong positive visual and text confirmation. - Ticket type
and relevant access details. - Time of scan.

**Already scanned** - Clear duplicate warning. - Previous scan time and
gate, if available and permitted. - Staff guidance for escalation.

**Invalid** - Clear explanation: wrong event, cancelled, refunded,
unknown code or other reason. - Avoid revealing unnecessary personal
information.

**Offline** - Visible offline status. - Explain whether local validation
is available. - Queue scan records safely for later synchronisation. -
Clearly flag any result that cannot be fully verified offline.

### Operational requirements

-   Large touch targets.
-   High contrast and outdoor readability.
-   Haptic and audio feedback that can be disabled or adjusted.
-   Fast camera startup.
-   Device and gate identification.
-   Safe sync and conflict handling.
-   Role-based access.
-   Audit log for manual overrides.

Offline mode must be designed and tested explicitly. Do not imply that a
ticket has been definitively validated if the device cannot verify it.

------------------------------------------------------------------------

## 9. Visual design direction

### 9.1 Overall aesthetic

**Direction:** contemporary, confident, clean and event-led.

The interface should feel energetic without becoming visually noisy. Use
event imagery to bring personality; use the application interface to
create clarity and trust.

Recommended characteristics: - Spacious layouts. - Strong typographic
hierarchy. - Restrained use of colour. - Clear cards and data
groupings. - High-quality event imagery. - Consistent iconography. -
Subtle motion for feedback, not decoration. - Clear status colours
supported by text and icons.

### 9.2 Brand and theming model

Separate the platform's product UI from each organiser's public event
branding.

**Platform UI** - Stable neutral foundation. - Consistent interaction
patterns. - Accessible text and control contrast. - Standardised status
colours.

**Event theme** - Logo and event artwork. - Primary accent colour. -
Optional background treatment. - Custom copy and content sections.

Do not allow organiser theme choices to change critical status colours,
reduce contrast or make controls difficult to recognise.

### 9.3 Typography

Use a highly legible sans-serif family with: - Distinct heading and body
styles. - Comfortable line height. - Tabular numerals for dashboards and
monetary values. - Clear differentiation between labels, helper text and
values.

Suggested type scale: - Display: 40--48 px - H1: 32 px - H2: 24 px - H3:
20 px - Body large: 18 px - Body: 16 px - Small: 14 px - Caption: 12 px,
used sparingly

These are starting values; validate against the chosen typeface and
responsive layouts.

### 9.4 Layout and spacing

Adopt a consistent spacing scale, for example: - 4 px - 8 px - 12 px -
16 px - 24 px - 32 px - 48 px - 64 px

Use a responsive grid. Avoid overly wide text columns and dashboard
cards that become unreadable at smaller sizes.

### 9.5 Component principles

Create reusable components for: - Buttons and icon buttons. - Text
inputs, selects and checkboxes. - Ticket cards. - Price and order
summaries. - Status badges. - KPI cards. - Data tables. - Search and
filter bars. - Date/time controls. - Empty states. - Error and success
messages. - Modals and confirmation dialogs. - Toast notifications. -
Pagination. - Tabs and navigation. - Charts and legends.

Each component needs defined default, hover, focus, active, disabled,
loading, error and success states where applicable.

------------------------------------------------------------------------

## 10. Design system foundations

### Colour roles

Define semantic tokens rather than hard-coding colours in individual
screens.

-   `surface` --- page and card backgrounds.
-   `text-primary` --- main text.
-   `text-secondary` --- supporting text.
-   `border` --- dividers and outlines.
-   `action-primary` --- primary actions.
-   `action-secondary` --- secondary actions.
-   `success` --- completed / valid.
-   `warning` --- attention required.
-   `danger` --- error / destructive.
-   `info` --- informational state.

Exact colour values should be selected and contrast-tested during visual
design. Do not rely on colour alone to communicate state.

### Buttons

-   Primary: one main action per context.
-   Secondary: supporting action.
-   Tertiary / text: low-emphasis action.
-   Destructive: actions such as cancellation or deletion.

Use clear action labels such as "Publish event", "Save changes" and
"Issue refund", not vague labels such as "Continue" when the result can
be named.

### Forms

-   Persistent labels.
-   Helpful examples and validation.
-   Clear required / optional indicators.
-   Error messages adjacent to the relevant field.
-   Preserve valid input after an error.
-   Group related fields logically.

### Data tables

-   Sticky header for long tables where useful.
-   Responsive column prioritisation.
-   Search, filters and saved views for large datasets.
-   Clear empty and loading states.
-   Row actions that remain discoverable.
-   Bulk actions with explicit selection count and confirmation.

### Charts

-   Clear title and date range.
-   Explicit units and currency.
-   Accessible legends.
-   Tooltips that are not the only source of information.
-   Empty and insufficient-data states.
-   Avoid 3D charts and misleading axes.

------------------------------------------------------------------------

## 11. Accessibility and inclusive design

Target **WCAG 2.2 AA** as the design and implementation baseline.

Requirements: - Keyboard access to all interactive functionality. -
Visible focus indicators. - Sufficient text and non-text contrast. -
Semantic headings and landmarks. - Proper labels and accessible error
announcements. - Screen-reader-friendly ticket and price information. -
No reliance on colour alone. - Touch targets sized for comfortable
use. - Respect reduced-motion preferences. - Accessible authentication
and payment flows. - Useful alt text for meaningful event imagery.

Test with automated tools and manual keyboard and screen-reader testing.
Accessibility is a release criterion, not a final polish task.

------------------------------------------------------------------------

## 12. Responsive behaviour

### Buyer experience

Design mobile-first. Test at narrow phone widths, common phone sizes,
tablets and desktop.

Mobile priorities: - Fast page load. - Visible event details. - Easy
ticket quantity selection. - Persistent but unobtrusive purchase CTA. -
Short forms and autofill. - Clear payment state. - Easy ticket
retrieval.

### Organiser experience

Desktop is the primary environment for complex event setup and
reporting. Tablet and mobile should still support monitoring, order
lookup and common operational tasks.

Do not simply shrink desktop tables onto a phone. Convert them into
prioritised cards or a focused detail view where needed.

### Scanning experience

Prioritise supported mobile devices and test on real hardware, in low
light, bright sunlight and unreliable network conditions.

------------------------------------------------------------------------

## 13. Content and microcopy guidelines

Use direct, calm and specific language.

Good: - "Tickets are not on sale yet." - "This ticket has already been
scanned at 20:14." - "Payment is still being confirmed. Please check
your order before trying again." - "You have 12 tickets remaining."

Avoid: - "Oopsie!" - "Something went wrong" without an explanation. -
"Almost gone!" without reliable inventory evidence. - "Success!" without
explaining what succeeded.

Every error should answer: 1. What happened? 2. What does it mean? 3.
What can the user do next?

Use consistent terminology across the buyer shop, organiser dashboard,
emails and scanner.

------------------------------------------------------------------------

## 14. Notifications and transactional communication

Design consistent templates for: - Order confirmation. - Ticket
delivery. - Payment pending / failed. - Refund confirmation. - Event
update or cancellation. - Ticket transfer, if supported. - Promoter
performance updates. - Organiser alerts.

Emails should be mobile-readable, accessible and consistent with the
event brand while retaining platform-level trust and support
information.

Transactional messages must be separated from marketing messages.
Consent and legal requirements should be reviewed for each message type
and jurisdiction.

------------------------------------------------------------------------

## 15. Security, privacy and permissions

The redesign must work with a clear role and permission model.

Potential roles: - Account owner - Administrator - Event manager -
Finance - Marketing - Door staff / scanner - Promoter / ambassador

Principles: - Least-privilege access. - No unnecessary exposure of buyer
personal data. - Clear audit history for financial and inventory
changes. - Secure account recovery and session management. - Appropriate
protection for ticket QR codes and transfer workflows. - Defined
retention and deletion policies. - Consent and lawful-purpose controls
for attendee data. - Privacy notices that explain what is collected and
why.

Work with engineering and legal stakeholders on GDPR, payment security
and applicable local requirements. This document is not a legal
compliance assessment.

------------------------------------------------------------------------

## 16. Analytics and success metrics

Instrument the existing product before redesigning wherever possible.
Establish a baseline, then compare after launch.

### Buyer funnel

-   Event page views.
-   Ticket selection rate.
-   Checkout start rate.
-   Checkout completion rate.
-   Purchase conversion rate.
-   Payment failure rate.
-   Checkout abandonment.
-   Time to purchase.
-   Mobile versus desktop conversion.

### Organiser activation

-   Time to create first event.
-   Percentage completing event setup.
-   Percentage publishing first event.
-   Time from account creation to first ticket sale.
-   Support requests during setup.

### Organiser engagement

-   Weekly active organisers.
-   Events managed per organiser.
-   Use of ticket, marketing and reporting features.
-   Repeat event creation.
-   Report and export usage.

### Event operations

-   Scan success rate.
-   Average scan time.
-   Duplicate scan rate.
-   Offline scan volume.
-   Sync failure rate.
-   Manual override rate.
-   Support incidents during event entry.

### Business metrics

-   Gross merchandise value / ticket sales volume.
-   Platform revenue and take rate.
-   Refund rate.
-   Chargeback rate.
-   Organiser retention.
-   Repeat event rate.
-   Support cost per event.

Define every metric precisely. Segment results by device, event type,
event size, traffic source and organiser cohort where appropriate. Avoid
treating a higher conversion rate as a success if refunds, chargebacks
or complaints also rise.

------------------------------------------------------------------------

## 17. Research and validation plan

Do not finalise the redesign based only on competitor screenshots or
internal opinions.

### Discovery

Interview: - 5--8 ticket buyers. - 5--8 event organisers of different
sizes. - 3--5 event-day staff or scanners. - 2--3 finance or
administration users.

These are suggested initial sample sizes, not statistically
representative research.

### Key research questions

**Buyers** - What information do they need before choosing a ticket? -
Where do they hesitate or abandon checkout? - Which payment methods do
they expect? - How do they retrieve tickets on event day?

**Organisers** - Which tasks take the most time? - What information do
they check daily? - Which settings are difficult to understand? - How do
they currently manage promoters, guestlists and refunds?

**Operations** - What causes queues at the entrance? - How are invalid
or duplicate tickets handled? - What happens when internet access
fails? - What information do staff need to resolve exceptions?

### Usability testing

Test prototypes for: 1. Buy one standard ticket on mobile. 2. Buy
multiple ticket types and an add-on. 3. Recover from a declined payment.
4. Create and publish a basic event. 5. Add an Early Bird ticket and a
later ticket tier. 6. Find an order and issue a permitted refund. 7.
Create a promoter link and understand its performance. 8. Scan a valid,
invalid and already-used ticket.

Measure task success, time on task, errors, confidence and qualitative
feedback.

------------------------------------------------------------------------

## 18. Recommended delivery roadmap

Prioritise foundational improvements before advanced features.

### Phase 0 --- Audit and baseline

-   Audit current flows and feature usage.
-   Review analytics and support tickets.
-   Map current architecture and integrations.
-   Identify accessibility and performance issues.
-   Establish baseline metrics.
-   Confirm technical constraints.

**Exit criteria:** agreed problem list, baseline and prioritised scope.

### Phase 1 --- Core buyer journey

-   Event page hierarchy.
-   Ticket selection.
-   Transparent order summary.
-   Checkout forms.
-   Payment states and recovery.
-   Confirmation and ticket retrieval.
-   Responsive and accessible components.

**Exit criteria:** improved usability and no regression in payment
reliability.

### Phase 2 --- Organiser foundations

-   Navigation and event workspace.
-   Onboarding and event creation.
-   Ticket and inventory management.
-   Event overview.
-   Orders and attendee search.
-   Core reports.

**Exit criteria:** organisers can complete common tasks with less time
and fewer errors.

### Phase 3 --- Growth and operations

-   Promoter / ambassador portal.
-   Guestlist workflows.
-   Marketing attribution.
-   Improved scanning UX.
-   Entry reporting.
-   Event-day operational alerts.

**Exit criteria:** validated usage and measurable operational benefit.

### Phase 4 --- Advanced capabilities

-   Waiting lists.
-   Seating plans, if relevant to target events.
-   Ticket resale / transfer protections.
-   Advanced segmentation and reporting.
-   Cashless or wallet integrations.
-   Automated financial workflows.

**Exit criteria:** each feature has demonstrated user demand, commercial
value and operational feasibility.

------------------------------------------------------------------------

## 19. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                    Potential impact        Mitigation
  ----------------------- ----------------------- -----------------------
  Redesign changes        Organiser frustration   Test with existing
  familiar workflows too  and support volume      users; provide
  much                                            onboarding and gradual
                                                  rollout

  Checkout becomes        Lower conversion        Performance budgets and
  visually richer but                             funnel measurement
  slower                                          

  Excessive customisation Inconsistent and        Guardrails, themes and
                          inaccessible shops      preview validation

  Inventory               Overselling and trust   Single source of truth,
  inconsistencies         damage                  concurrency testing and
                                                  audit logs

  Unclear financial       Poor organiser          Explicit definitions
  metrics                 decisions               and reconciliation

  Offline scanning        Duplicate or incorrect  Defined offline policy,
  conflicts               entry decisions         device sync and
                                                  exception workflow

  Feature scope expands   Delayed launch          Phase-based roadmap and
                                                  prioritisation

  Data access is too      Privacy and security    Role-based access and
  broad                   exposure                least privilege

  New UI hides existing   Adoption drop           Task-based migration
  functionality                                   testing and contextual
                                                  guidance
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 20. Prioritisation framework

Score proposed features on: - User impact. - Frequency of use. - Revenue
or retention impact. - Risk reduction. - Implementation effort. -
Dependencies.

A simple priority model:

**P0 --- Essential** - Reliable ticket inventory. - Clear ticket
selection. - Checkout and payment recovery. - Order confirmation and
ticket delivery. - Core event setup. - Order lookup. - Reliable scanning
and entry validation. - Permissions and auditability.

**P1 --- High value** - Sales dashboard. - Attendee management. -
Guestlists. - Discounts and access codes. - Promoter attribution. -
Better exports and reporting. - Improved shop customisation.

**P2 --- Differentiation** - Waiting lists. - Advanced campaign
analytics. - Seating plans. - Ticket transfer / resale workflows. -
Advanced automation. - Connected cashless ecosystem.

Priorities must be revisited after research and technical discovery.

------------------------------------------------------------------------

## 21. Definition of done

A redesigned flow is ready to release when:

-   The primary task can be completed by representative users.
-   Responsive layouts work at agreed breakpoints.
-   Loading, empty, error, success and disabled states are designed.
-   Keyboard and screen-reader behaviour has been reviewed.
-   Analytics events are implemented and verified.
-   Security and permission rules are tested.
-   Performance meets agreed budgets.
-   Transactional emails and support content are updated where needed.
-   Engineering, product, design and operations approve the workflow.
-   Rollback or feature-flag strategy exists for high-risk changes.

------------------------------------------------------------------------

## 22. Key screens to design

The following screen inventory can be used to scope Figma files and
implementation tickets.

### Public / buyer

1.  Event landing page --- desktop.
2.  Event landing page --- mobile.
3.  Ticket selection --- available states.
4.  Ticket selection --- sold-out / not-yet-on-sale states.
5.  Add-ons selection.
6.  Checkout --- contact details.
7.  Checkout --- order review.
8.  Checkout --- payment processing.
9.  Checkout --- payment failure / recovery.
10. Order confirmation.
11. Ticket detail / wallet.
12. Event update / cancellation information.

### Organiser

13. Sign-up / sign-in.
14. First-time onboarding.
15. Event list.
16. Create event --- basics.
17. Create event --- tickets.
18. Create event --- shop design.
19. Create event --- checkout settings.
20. Publish review.
21. Event overview dashboard.
22. Ticket management list.
23. Ticket create / edit.
24. Orders list.
25. Order detail.
26. Attendees list.
27. Attendee detail.
28. Guestlist management.
29. Promoter list.
30. Promoter performance detail.
31. Discount / access code management.
32. Reports.
33. Payout / finance view.
34. Event settings and team permissions.

### Entry operations

35. Scanner home / gate selection.
36. Camera scanning.
37. Valid ticket result.
38. Duplicate scan result.
39. Invalid ticket result.
40. Offline state.
41. Manual attendee lookup.
42. Scan activity / sync status.

------------------------------------------------------------------------

## 23. Handoff requirements

For each designed screen, handoff should include: - User goal and entry
point. - Layout at supported breakpoints. - Component and token
references. - Interaction behaviour. - Validation rules. - Loading,
empty, error and success states. - Permissions and role assumptions. -
Analytics events. - Accessibility notes. - Responsive behaviour. -
Relevant API / data dependencies. - Acceptance criteria.

For critical transactional flows, include a state diagram or interaction
specification. Screenshots alone are not a sufficient engineering
handoff.

------------------------------------------------------------------------

## 24. Decisions to confirm before detailed design

The following questions materially affect the final design and should be
answered during discovery:

1.  What is the current platform's strongest existing capability?
2.  Which user group is the redesign's highest priority: buyers,
    organisers or both?
3.  What event categories and typical event sizes are most important?
4.  Which payment providers and payment methods are currently supported?
5.  Is the product primarily a ticket shop, an organiser SaaS platform
    or a broader event operating system?
6.  Does it already support seating, waiting lists, resale, promoters,
    guestlists or scanning?
7.  Which parts of the current experience generate the most support
    requests?
8.  Which integrations must remain unchanged?
9.  What is the current design system and frontend technology?
10. What are the commercial goals and success metrics for the redesign?

------------------------------------------------------------------------

## 25. Recommended design north star

The redesign should not attempt to win by adding the largest number of
features. It should win by making the essential jobs feel dramatically
easier.

**For buyers:** understand the event, choose confidently, pay securely
and access the ticket instantly.

**For organisers:** publish quickly, sell effectively, understand
performance and manage every attendee.

**For event staff:** scan confidently, resolve exceptions and keep entry
moving.

A coherent product experience across these three moments---purchase,
management and entry---is the foundation of a strong ticketing platform.

**Final design principle:** Make the event feel special. Make the
software feel effortless.
