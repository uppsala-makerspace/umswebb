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
  { href: { sv: '/lokalen/',         en: '/en/our-space/' },       label: { sv: 'Besök oss',      en: 'Visit us' } },
  { href: { sv: '/bli-medlem/',      en: '/en/bli-medlem/' },      label: { sv: 'Bli medlem',     en: 'Become a member' } },
  { href: { sv: '/kalender/',        en: '/en/calendar/' },        label: { sv: 'Kalendern',      en: 'Calendar' } },
  { href: { sv: '/nyheter/',         en: '/en/news/' },            label: { sv: 'Nyheter',        en: 'News' } },
  { href: { sv: '/vanliga-fragor/',  en: '/en/vanliga-fragor/' },  label: { sv: 'Vanliga frågor', en: 'FAQ' } },
  { href: { sv: '/om/',              en: '/en/om/' },              label: { sv: 'Om oss',         en: 'About' } },
  {
    href: { sv: 'https://app.uppsalamakerspace.se/', en: 'https://app.uppsalamakerspace.se/' },
    external: true,
    label: { sv: 'App för medlemmar', en: 'Member app' },
  },
  {
    // Served under the same domain at /tutorial/, but rendered with the
    // external ↗ glyph + new-tab behaviour since it's a separate sub-site.
    href: {
      sv: 'https://www.uppsalamakerspace.se/tutorial/sv/index.html',
      en: 'https://www.uppsalamakerspace.se/tutorial/en/index.html',
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
