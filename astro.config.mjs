import { defineConfig } from 'astro/config';

/* This file runs before Astro loads `.env`, so read it here too — otherwise the
 * site URL could only be set through a real environment variable, and the one
 * file that configures a deployment would not cover it. Node's own reader, so
 * nothing is imported for it; values already in the environment win, and a
 * missing file is fine. */
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  // Staging is https://beta.uppsalamakerspace.se — set UMS_SITE_URL there so
  // absolute URLs do not point at production.
  site: process.env.UMS_SITE_URL || 'https://www.uppsalamakerspace.se',
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
