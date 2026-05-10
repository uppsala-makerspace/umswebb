import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.uppsalamakerspace.se',
  i18n: {
    defaultLocale: 'sv',
    locales: ['sv', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
    fallback: {
      en: 'sv',
    },
  },
});
