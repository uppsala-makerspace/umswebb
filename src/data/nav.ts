// Site navigation.
//
// When you translate a page, also update the matching `href.en` entry below.
// Right now most EN slugs mirror the SV ones; those EN routes will 404 until
// the corresponding `en/<file>.md` exists.

export type Locale = 'sv' | 'en';

export type NavItem = {
  href: Record<Locale, string>;
  label: Record<Locale, string>;
  external?: boolean;
};

export const primaryNav: NavItem[] = [
  { href: { sv: '/',                 en: '/en/' },                 label: { sv: 'Start',          en: 'Home' } },
  { href: { sv: '/vad-vi-gor/',      en: '/en/what-we-do/' },      label: { sv: 'Vad vi gör',     en: 'What we do' } },
  { href: { sv: '/lokalen/',         en: '/en/our-space/' },       label: { sv: 'Vår lokal',      en: 'Our space' } },
  { href: { sv: '/bli-medlem/',      en: '/en/become-a-member/' }, label: { sv: 'Bli medlem',     en: 'Become a member' } },
  { href: { sv: '/kalender/',        en: '/en/calendar/' },        label: { sv: 'Kalendern',      en: 'Calendar' } },
  { href: { sv: '/nyheter/',         en: '/en/news/' },            label: { sv: 'Nyheter',        en: 'News' } },
  { href: { sv: '/vanliga-fragor/',  en: '/en/faq/' },             label: { sv: 'Vanliga frågor', en: 'FAQ' } },
  { href: { sv: '/om/',              en: '/en/about/' },           label: { sv: 'Om oss',         en: 'About' } },
  {
    href: { sv: 'https://app.uppsalamakerspace.se/', en: 'https://app.uppsalamakerspace.se/' },
    external: true,
    label: { sv: 'App för medlemmar', en: 'Member app' },
  },
  {
    // A separate site on its own subdomain, hence the external ↗ glyph and
    // new-tab behaviour. Swedish is the root; English lives under /en/.
    href: {
      sv: 'https://tutorial.uppsalamakerspace.se/',
      en: 'https://tutorial.uppsalamakerspace.se/en/',
    },
    external: true,
    label: { sv: 'Guider', en: 'Guides' },
  },
  {
    href: { sv: 'https://data.uppsalamakerspace.se/tool', en: 'https://data.uppsalamakerspace.se/tool' },
    external: true,
    label: { sv: 'Våra verktyg', en: 'Our tools' },
  },
  {
    href: { sv: 'https://wiki.uppsalamakerspace.se/', en: 'https://wiki.uppsalamakerspace.se/' },
    external: true,
    label: { sv: 'Wiki', en: 'Wiki' },
  },
];
