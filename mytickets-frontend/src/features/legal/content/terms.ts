import type { Language } from '@/lib/i18n'

import { type LegalDocument, OPERATOR } from './types'

export const terms: Record<Language, LegalDocument> = {
  en: {
    title: 'Terms of service',
    intro: `These terms apply when you use ${OPERATOR.name}: as a member of an organisation, or as an organiser running one. By creating an account you agree to them.`,
    sections: [
      {
        heading: 'What MyTickets is',
        body: [
          `${OPERATOR.name} is a platform that organisations (clubs, student associations, party organisers) use to sell memberships and tickets, and to keep a token balance and NFC cards for their members.`,
          'The organisation you join runs its events, sets its prices and decides who may join. MyTickets provides the software; it does not organise the events.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'You have one MyTickets account: one email address and password for every organisation you join or run. Each organisation keeps its own record of you, with your details for it, your membership, tickets, tokens and cards there.',
          'Give correct details, keep your password to yourself and tell the organisation straight away if your card is lost or someone else uses your account. You are responsible for what happens with your account and your linked cards until you block them.',
        ],
      },
      {
        heading: 'Memberships and tickets',
        body: [
          'A membership runs until the end date the organisation set for it, or for as long as the organisation says. The organisation can approve or refuse requests, and can end a membership, for example when its own rules are broken.',
          'Tickets are sold by the organisation. Questions about an event, a cancellation or a refund go to that organisation, under its own conditions.',
        ],
      },
      {
        heading: 'Tokens and cards',
        body: [
          'Tokens are credit at one organisation: one token is worth one euro there and can only be spent with that organisation. They are not money and cannot be transferred to another organisation.',
          'Whether unused tokens can be paid back is up to the organisation. Block a lost card yourself under your cards, or ask the organisation; tokens spent before it was blocked cannot be returned.',
        ],
      },
      {
        heading: 'Payments',
        body: [
          'Online payments are handled by our payment provider, Stripe. MyTickets never sees or stores your card details. A payment is final once it is confirmed; refunds go through the organisation.',
        ],
      },
      {
        heading: 'Organisers',
        body: [
          'If you create an organisation, you are responsible for its page, its events, its prices and how it treats its members, and for following the law that applies to them (consumer law, tax, event permits).',
          'You decide which details your organisation asks of members and you are the controller of those details under the GDPR. MyTickets processes them on your behalf, as described in the privacy policy.',
          "Online payments are passed on to your organisation's Stripe account minus MyTickets' fee, which includes Stripe's card costs. Stripe's costs of paying you out (a fee on each payout to your bank, and a monthly fee in months with payouts) are yours too. MyTickets sets them aside from your payments before passing them on, keeping a small buffer so they are always paid in advance. The buffer stays your money and is settled when your organisation closes.",
        ],
      },
      {
        heading: 'Fair use',
        body: [
          "Do not misuse MyTickets: no fake accounts, no attempts to get into other people's accounts or cards, no copying or reselling tickets against an organisation's rules, and nothing unlawful. We may close accounts that do.",
        ],
      },
      {
        heading: 'Availability and liability',
        body: [
          'We work to keep MyTickets running and your data safe, but we cannot promise it is never unavailable. We are not liable for indirect loss, or for what an organisation does or does not do. Nothing in these terms limits rights you have under Belgian or EU consumer law.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          'When these terms change in a way that matters, we tell you and may ask you to agree again. Belgian law applies.',
          `Questions? Contact us at ${OPERATOR.contactEmail}.`,
        ],
      },
    ],
  },
  nl: {
    title: 'Gebruiksvoorwaarden',
    intro: `Deze voorwaarden gelden wanneer je ${OPERATOR.name} gebruikt: als lid van een organisatie of als organisator. Door een account te maken ga je ermee akkoord.`,
    sections: [
      {
        heading: 'Wat MyTickets is',
        body: [
          `${OPERATOR.name} is een platform waarmee organisaties (clubs, studentenverenigingen, feestorganisatoren) lidmaatschappen en tickets verkopen, en een tokensaldo en NFC-kaarten bijhouden voor hun leden.`,
          'De organisatie waar je lid van wordt, organiseert haar evenementen, bepaalt haar prijzen en beslist wie lid mag worden. MyTickets levert de software; het organiseert de evenementen niet.',
        ],
      },
      {
        heading: 'Je account',
        body: [
          'Je hebt één MyTickets-account: één e-mailadres en wachtwoord voor elke organisatie waar je lid van bent of die je beheert. Elke organisatie houdt haar eigen gegevens over je bij: je gegevens voor haar, je lidmaatschap, tickets, tokens en kaarten daar.',
          'Geef juiste gegevens, houd je wachtwoord voor jezelf en meld het meteen aan de organisatie als je kaart kwijt is of iemand anders je account gebruikt. Je bent verantwoordelijk voor wat er met je account en je gekoppelde kaarten gebeurt tot je ze blokkeert.',
        ],
      },
      {
        heading: 'Lidmaatschappen en tickets',
        body: [
          'Een lidmaatschap loopt tot de einddatum die de organisatie ervoor koos, of zolang de organisatie dat bepaalt. De organisatie kan aanvragen goedkeuren of weigeren, en een lidmaatschap beëindigen, bijvoorbeeld wanneer haar regels niet worden nageleefd.',
          'Tickets worden verkocht door de organisatie. Vragen over een evenement, een annulering of een terugbetaling stel je aan die organisatie, volgens haar eigen voorwaarden.',
        ],
      },
      {
        heading: 'Tokens en kaarten',
        body: [
          'Tokens zijn tegoed bij één organisatie: één token is daar één euro waard en kan alleen bij die organisatie worden besteed. Het is geen geld en kan niet naar een andere organisatie worden overgezet.',
          'Of ongebruikte tokens worden terugbetaald, beslist de organisatie. Blokkeer een verloren kaart zelf bij je kaarten, of vraag het aan de organisatie; tokens die werden besteed voor de blokkering kunnen niet worden teruggegeven.',
        ],
      },
      {
        heading: 'Betalingen',
        body: [
          'Online betalingen verlopen via onze betaalprovider Stripe. MyTickets ziet of bewaart je kaartgegevens nooit. Een betaling is definitief zodra ze bevestigd is; terugbetalingen lopen via de organisatie.',
        ],
      },
      {
        heading: 'Organisatoren',
        body: [
          'Maak je een organisatie aan, dan ben je verantwoordelijk voor haar pagina, evenementen, prijzen en de manier waarop ze met haar leden omgaat, en voor het naleven van de wetten die daarop van toepassing zijn (consumentenrecht, belastingen, vergunningen).',
          'Je bepaalt welke gegevens je organisatie aan leden vraagt en je bent onder de AVG (GDPR) verwerkingsverantwoordelijke voor die gegevens. MyTickets verwerkt ze in jouw opdracht, zoals beschreven in de privacyverklaring.',
          'Online betalingen gaan naar het Stripe-account van je organisatie, min de vergoeding van MyTickets, waarin de kaartkosten van Stripe zitten. De kosten die Stripe rekent om je uit te betalen (per uitbetaling naar je bank, en maandelijks in maanden met uitbetalingen) zijn ook voor jou. MyTickets houdt ze opzij van je betalingen voor ze worden doorgestort, met een kleine buffer zodat ze altijd vooraf betaald zijn. Die buffer blijft jouw geld en wordt verrekend wanneer je organisatie stopt.',
        ],
      },
      {
        heading: 'Eerlijk gebruik',
        body: [
          'Misbruik MyTickets niet: geen valse accounts, geen pogingen om in andermans account of kaart te komen, geen tickets kopiëren of doorverkopen tegen de regels van een organisatie in, en niets wat onwettig is. Accounts die dat doen, kunnen we sluiten.',
        ],
      },
      {
        heading: 'Beschikbaarheid en aansprakelijkheid',
        body: [
          'We doen ons best om MyTickets draaiende en je gegevens veilig te houden, maar we kunnen niet beloven dat het nooit onbereikbaar is. We zijn niet aansprakelijk voor indirecte schade, of voor wat een organisatie wel of niet doet. Niets in deze voorwaarden beperkt de rechten die je hebt onder het Belgische of Europese consumentenrecht.',
        ],
      },
      {
        heading: 'Wijzigingen en contact',
        body: [
          'Veranderen deze voorwaarden op een belangrijke manier, dan laten we het je weten en kunnen we je opnieuw om akkoord vragen. Het Belgisch recht is van toepassing.',
          `Vragen? Neem contact op via ${OPERATOR.contactEmail}.`,
        ],
      },
    ],
  },
}
