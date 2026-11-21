import type { Language } from '@/lib/i18n'

import { type LegalDocument, OPERATOR } from './types'

export const privacy: Record<Language, LegalDocument> = {
  en: {
    title: 'Privacy policy',
    intro: `This explains which personal data ${OPERATOR.name} keeps, why, and what you can ask of us. It follows the EU General Data Protection Regulation (GDPR).`,
    sections: [
      {
        heading: 'Who is responsible',
        body: [
          'Your details as a member are kept for the organisation you joined. That organisation decides what it asks and what it uses it for: it is the controller, and MyTickets processes the data on its behalf.',
          `For organiser accounts and for running the platform itself, ${OPERATOR.name} is the controller.`,
          "Every organisation's data is kept in its own separate database. One organisation cannot see your account at another.",
        ],
      },
      {
        heading: 'What we keep',
        body: [
          [
            'Your account: email address and password (stored only as a secure hash, never readable).',
            'The details the organisation asks when you choose a membership, such as your name, phone number, address, school, faculty and year of study.',
            'Your memberships over the years, your tickets and when they were scanned at the door.',
            'Your token balance and every top-up and purchase, and the numbers of the NFC cards linked to your account.',
            'Payments: amount, what it was for and its status. Card details are handled by Stripe and never reach us.',
            'When you agreed to these terms and this policy, and which version.',
          ],
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To run your account, membership, tickets, tokens and cards (the contract with you); to keep payment and accounting records (a legal obligation); and to protect the service against misuse (legitimate interest). We do not sell your data and do not use it for advertising.',
        ],
      },
      {
        heading: 'Who else sees it',
        body: [
          'People working for the organisation you joined: its admins and staff see your details, tokens, cards and memberships over the years; door and bar staff only see your name, membership and tokens when they scan your card or code.',
          'Stripe, for online payments, and, if you add your membership to it, Apple Wallet or Google Wallet. We share nothing else unless the law requires it.',
        ],
      },
      {
        heading: 'Cookies and storage',
        body: [
          'We use one cookie that keeps you signed in, and your browser remembers the language you chose. These are needed for the site to work, so we do not ask for consent. There are no tracking or advertising cookies.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'As long as you have an account. When it is removed, your details go with it, except payment and transaction records, which are kept as long as accounting law requires (in Belgium up to 7 years).',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can see and correct most of your details yourself under My details. You can also ask for a copy of your data, to have it corrected or deleted, to limit or object to its use, or to receive it in a portable format.',
          `Ask the organisation you joined, or contact us at ${OPERATOR.contactEmail}; we answer within a month. If you are not satisfied, you can complain to the Belgian Data Protection Authority (gegevensbeschermingsautoriteit.be).`,
        ],
      },
      {
        heading: 'Changes',
        body: ['When this policy changes in a way that matters, we tell you before it applies.'],
      },
    ],
  },
  nl: {
    title: 'Privacyverklaring',
    intro: `Hier lees je welke persoonsgegevens ${OPERATOR.name} bijhoudt, waarom, en wat je van ons kunt vragen. We volgen de Europese Algemene Verordening Gegevensbescherming (AVG/GDPR).`,
    sections: [
      {
        heading: 'Wie verantwoordelijk is',
        body: [
          'Je gegevens als lid worden bijgehouden voor de organisatie waar je lid van werd. Die organisatie bepaalt wat ze vraagt en waarvoor ze het gebruikt: zij is de verwerkingsverantwoordelijke, en MyTickets verwerkt de gegevens in haar opdracht.',
          `Voor accounts van organisatoren en voor het platform zelf is ${OPERATOR.name} de verwerkingsverantwoordelijke.`,
          'De gegevens van elke organisatie staan in een eigen, aparte database. Een organisatie kan je account bij een andere organisatie niet zien.',
        ],
      },
      {
        heading: 'Wat we bijhouden',
        body: [
          [
            'Je account: e-mailadres en wachtwoord (alleen als veilige hash bewaard, nooit leesbaar).',
            'De gegevens die de organisatie vraagt wanneer je een lidmaatschap kiest, zoals je naam, telefoonnummer, adres, school, faculteit en studiejaar.',
            'Je lidmaatschappen door de jaren heen, je tickets en wanneer ze aan de deur gescand werden.',
            'Je tokensaldo en elke oplading en aankoop, en de nummers van de NFC-kaarten die aan je account gekoppeld zijn.',
            'Betalingen: bedrag, waarvoor en de status. Kaartgegevens worden door Stripe verwerkt en komen nooit bij ons.',
            'Wanneer je akkoord ging met deze voorwaarden en deze verklaring, en met welke versie.',
          ],
        ],
      },
      {
        heading: 'Waarom we ze gebruiken',
        body: [
          'Om je account, lidmaatschap, tickets, tokens en kaarten te laten werken (de overeenkomst met jou); om betalingen en boekhouding bij te houden (een wettelijke plicht); en om de dienst tegen misbruik te beschermen (gerechtvaardigd belang). We verkopen je gegevens niet en gebruiken ze niet voor reclame.',
        ],
      },
      {
        heading: 'Wie ze nog ziet',
        body: [
          'Mensen die voor de organisatie werken waar je lid van bent: beheerders en medewerkers zien je gegevens, tokens, kaarten en lidmaatschappen door de jaren heen; deur- en barpersoneel zien alleen je naam, lidmaatschap en tokens wanneer ze je kaart of code scannen.',
          'Stripe, voor online betalingen, en Apple Wallet of Google Wallet als je je lidmaatschap daaraan toevoegt. Verder delen we niets, tenzij de wet het vereist.',
        ],
      },
      {
        heading: 'Cookies en opslag',
        body: [
          'We gebruiken één cookie die je aangemeld houdt, en je browser onthoudt de taal die je koos. Die zijn nodig om de site te laten werken, dus vragen we er geen toestemming voor. Er zijn geen tracking- of reclamecookies.',
        ],
      },
      {
        heading: 'Hoe lang we ze bewaren',
        body: [
          'Zolang je een account hebt. Wordt het verwijderd, dan verdwijnen je gegevens mee, behalve betalings- en transactiegegevens, die we bewaren zolang de boekhoudwetgeving dat vraagt (in België tot 7 jaar).',
        ],
      },
      {
        heading: 'Je rechten',
        body: [
          'De meeste gegevens kun je zelf bekijken en aanpassen bij Mijn gegevens. Je kunt ook een kopie van je gegevens vragen, ze laten verbeteren of wissen, het gebruik ervan laten beperken of er bezwaar tegen maken, of ze in een overdraagbaar formaat krijgen.',
          `Vraag het aan de organisatie waar je lid van bent, of neem contact op via ${OPERATOR.contactEmail}; we antwoorden binnen een maand. Ben je niet tevreden, dan kun je klacht indienen bij de Gegevensbeschermingsautoriteit (gegevensbeschermingsautoriteit.be).`,
        ],
      },
      {
        heading: 'Wijzigingen',
        body: [
          'Verandert deze verklaring op een belangrijke manier, dan laten we het je weten voor ze geldt.',
        ],
      },
    ],
  },
}
