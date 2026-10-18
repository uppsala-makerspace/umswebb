import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

/* This file runs before Astro loads `.env`, so read it here too — otherwise the
 * site URL could only be set through a real environment variable, and the one
 * file that configures a deployment would not cover it. Node's own reader, so
 * nothing is imported for it; values already in the environment win, and a
 * missing file is fine. */
try {
  process.loadEnvFile();
} catch {}

/* src/lib/entries.ts downloads the members API's icons, photos and floor plans
 * into public/ums-data/ while the pages render — but Astro has copied public/
 * into the output by then, so on a fresh checkout they would be missing from
 * the build. Copy them over once the build is done. */
const umsData = {
  name: 'ums-data',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      await cp(
        fileURLToPath(new URL('./public/ums-data/', import.meta.url)),
        fileURLToPath(new URL('./ums-data/', dir)),
        { recursive: true }
      );
    },
  },
};

export default defineConfig({
  integrations: [umsData],
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
