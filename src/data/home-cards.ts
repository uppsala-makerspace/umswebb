import type { Locale } from './nav';

export type HomeCard = {
  href: Record<Locale, string>;
  icon: string;
  label: Record<Locale, string>;
  blurb: Record<Locale, string>;
};

export const homeCards: HomeCard[] = [
  {
    href: { sv: '/lokalen/', en: '/en/our-space/' },
    icon: '📍',
    label: { sv: 'Besök oss', en: 'Visit us' },
    blurb: {
      sv: 'Var vi finns och hur du hittar hit.',
      en: 'Where we are and how to find us.',
    },
  },
  {
    href: { sv: '/bli-medlem/', en: '/en/bli-medlem/' },
    icon: '🧑‍🤝‍🧑',
    label: { sv: 'Bli medlem', en: 'Join us' },
    blurb: {
      sv: 'Skapa, bygg och umgås — alla är välkomna.',
      en: 'Make, build, hang out — everyone is welcome.',
    },
  },
  {
    href: { sv: '/kalender/', en: '/en/calendar/' },
    icon: '📅',
    label: { sv: 'Kalender', en: 'Calendar' },
    blurb: {
      sv: 'Kommande workshops, kurser och öppna kvällar.',
      en: 'Upcoming workshops, courses, and open evenings.',
    },
  },
];
// Note: the "Nyheter" / "News" card is rendered separately in the home page
// as a full-width card containing the latest-news list.
