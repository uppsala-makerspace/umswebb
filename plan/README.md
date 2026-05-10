# Plans

The roadmap for the bilingual rebuild of uppsalamakerspace.se on Astro.
Tackle one plan at a time. When picking up a plan, run
`/roadmap resume "plan name"`.

---

### ONGOING: Visual design and styling
- **Tags:** frontend, design
- **Depends on:** —
- **Last updated:** 2026-05-10
- **Done:** Direction captured in `visual-design.md`. **Phase 1 (foundation)**: `src/styles/global.css` with light + dark tokens (extends tutorial palette with warm amber accent), reset, base type, prose container. `BaseLayout.astro` rewritten with sticky header (logo + primary nav + dark-mode toggle + lang-switcher pill), prose-vs-wide layout switch via a `prose` prop, footer with secondary nav. Inline pre-paint theme-init script + post-load toggle handler (no FOUC). **Phase 2 (home)**: `src/data/home-cards.ts` defines the four destinations (Visit / Join / Activities / News). Home pages (`/` and `/en/`) replaced with stamp logo + tagline hero, four-card grid, then a compact news list. start.md still in the collection (used for `<meta description>`); body no longer rendered on home.
- **Next step:** **Phase 3 (content polish)** — review imported pages and posts in the new prose container; tune headings, lists, image sizing, code blocks, table styles. **Phase 4 (typography iteration)** — experiment with Inter / Atkinson Hyperlegible / a humanist sans against the system stack now that content is visible.
- **Details:** `visual-design.md`

### ONGOING: Sidebar navigation
- **Tags:** frontend, accessibility, mobile
- **Depends on:** —
- **Last updated:** 2026-05-10
- **Next step:** Phase 1 — restructure `BaseLayout.astro` into an app-shell (sidebar + main grid at ≥ 768 px, stacked below) and rewrite the chrome CSS in `global.css`. Open questions resolved: stamp+wordmark on mobile down to ~360 px, ↗ for Wiki link, Kontakt stays in footer.
- **Details:** `sidebar-nav.md`

### NOT STARTED: English translations
- **Tags:** content, i18n
- **Depends on:** Translated page URLs
- **Next step:** Translate the highest-priority pages first (start, lokalen, bli-medlem, om, vanliga-fragor). Each EN file mirrors its SV counterpart's `translationKey`. Decide whether to translate news posts or only the static pages; news fallback to SV is already wired via `astro.config.mjs`.

### NOT STARTED: Sveltia CMS integration
- **Tags:** tooling, editorial
- **Depends on:** Visual design and styling, Translated page URLs
- **Next step:** Add `public/admin/index.html` loading Sveltia from CDN, plus `public/admin/config.yml` mirroring the content collections (pages + posts, both locales, media folder `public/uploads/`). Register an OAuth app on the Git host (GitHub or GitLab once the repo is hosted). Smoke-test as an editor.

---

## Completed

### DONE: Astro scaffold and content schema
- **Tags:** scaffolding
- **Last updated:** 2026-05-10
- **Done:** Astro 6 project initialised, i18n configured (sv default no-prefix, en at `/en/`, fallback en→sv), content collections defined in `src/content.config.ts` with Zod schemas for pages and posts (both keyed by `lang` + `translationKey`), BaseLayout, dynamic `[...slug].astro` routes per locale, public uploads folder.

### DONE: Import WordPress content
- **Tags:** content migration
- **Last updated:** 2026-05-10
- **Done:** WXR (`uppsalamakerspace.WordPress.2026-05-09.xml`) processed via `wordpress-export-to-markdown` into `_wp-import/`, then `scripts/import-wp-postprocess.mjs` strips qTranslate-X markers, normalises frontmatter to schema, and moves files into `src/content/{pages,posts}/sv/`. Result: 22 published pages + 5 drafts, 230 published posts + 5 drafts, 272 images in `public/uploads/wp/`. Re-runnable.

### DONE: Rewrite old-domain URLs
- **Tags:** content migration
- **Last updated:** 2026-05-10
- **Done:** `rewriteOldDomainLinks()` in the post-process script converts page links (`https://www.uppsalamakerspace.se/foo/` → `/foo/`), dated WP permalinks (`/YYYY/MM/DD/slug/` → `/nyheter/slug/`), and wp-content asset URLs to local paths when the file was imported. PDF, subdomain, and Facebook redirector URLs are deliberately preserved as external. 326 root-relative links, ~60 PDF refs left external.

### DONE: Translated page URLs
- **Tags:** i18n, schema
- **Last updated:** 2026-05-10
- **Done:** Filenames stay stable in git (`en/lokalen.md`); URLs come from frontmatter when overridden. Added optional `slug?: string` field to `pageSchema` (inherited by `postSchema`). New `src/lib/slug.ts` helpers (`pageSlug`, `postSlug`) resolve `data.slug ?? <filename stem>` and `data.slug ?? translationKey` respectively, used by all four dynamic routes (`[...slug].astro` ×2, `nyheter/[slug].astro`, `en/news/[slug].astro`) and all four post listings. `src/data/nav.ts` switched from a single `href: string` + `localizeHref()` helper to per-locale `href: { sv, en }`; the helper is gone. Smoke test: `en/lokalen.md` with `slug: our-space` builds at `/en/our-space/` (not `/en/lokalen/`), nav.ts updated accordingly. **Editor workflow** for a new translation: create `en/<filename>.md` with `slug: <translated-slug>` in frontmatter, then update the matching `nav.ts` entry.

### DONE: Home page consolidation
- **Tags:** content, routing
- **Last updated:** 2026-05-10
- **Done:** `start.md` stays in the content collection so editors can update it; `src/pages/index.astro` now loads it via `getEntry('pages', 'sv/start')` and renders `<Content />` above the news listing. `start` added to a `RESERVED_SLUGS` set inside `getStaticPaths` of `[...slug].astro` (had to be inline because Astro hoists `getStaticPaths` past module scope) so `/start/` no longer duplicates `/`. EN home (`/en/index.astro`) follows the same pattern with a Swedish fallback when no English start page exists, displaying a small "not yet translated" notice. 258 → 257 pages.

### DONE: Imported content cleanup
- **Tags:** content, manual
- **Last updated:** 2026-05-10
- **Done:** All cleanup encoded in `scripts/import-wp-postprocess.mjs` so it survives re-imports. **Pages**: deleted 7 (`test`, `test123`, `testkalendern-exe`, `keramikverkstad` (campaign closed), `pysselfika`, `pepparkaksbybygge`, `vi-skapar-en-3d-skrivare-fran-grunden`); force-drafted `ungdomsverksamhet` (4-line "discussion underlay"); deleted 5 abandoned drafts (`id-117`, `id-124`, `id-910`, `id-2273`, `verksamhet`). **Posts**: renamed 8 with garbage slugs (`441` → `3d-modelleringskurs-i-blender-2016`; the 7 `wp-json-wp-v2-posts-NNNN` posts → human slugs derived from titles, with `2070`/`441` disambiguated by year). **Inbound link patching**: `/keramikverkstad/` and `/aktiviteter/keramikverkstad/` redirect to `/nyheter/succe-for-keramiken/` (the wrap-up post); links to other deleted slugs are unlinked (text kept, broken `[…](href)` wrapping removed). Pages went 22 → 13 published + 1 draft, posts stay at 230 published. 258 pages build clean, 0 unresolved internal references.

### DONE: Restore navigation menu
- **Tags:** content migration, frontend
- **Last updated:** 2026-05-10
- **Done:** Parsed 10 `nav_menu_item` entries from WXR via inline Python — found two menus: `topmenu` (9 items, primary) and `kontakta` (1 item, secondary). Resolved the 3 menu items with empty titles by following their `_menu_item_object_id` to the linked page title. Wrote `src/data/nav.ts` with `primaryNav` and `secondaryNav` arrays, locale labels for sv+en, an `external` flag for the Wiki link, and a `localizeHref()` helper that prefixes internal links with `/en/` for the English locale. `BaseLayout.astro` now renders both menus with `aria-current="page"` highlighting and `target="_blank"` on external links. Medlemsprojekt was repointed from the dead old wiki URL to the local `/medlemsprojekt/` page; revisit if the original intent was the wiki.

### DONE: Backfill missing PDFs
- **Tags:** content migration, script
- **Last updated:** 2026-05-10
- **Done:** `scripts/backfill-pdfs.mjs` walks `src/content/`, finds PDF URLs at `*.uppsalamakerspace.se/wp-content/uploads/...`, fetches each via Node `fetch`, and saves to `public/uploads/wp/<decoded-basename>`. Idempotent (skips files already present). 74 URLs collapsed to 69 unique decoded basenames (3 percent-encoded duplicates plus a 2015 re-upload pair). Re-running the import post-process rewrote all 88 PDF references to local paths. Old-domain refs in content went from 105 → 17 (subdomains + Facebook redirector URLs, all deliberately preserved).

### DONE: Paginate news listing
- **Tags:** improvement, frontend
- **Last updated:** 2026-05-10
- **Done:** 20 posts per page. Page 1 at `/nyheter/`; pages 2–12 at `/nyheter/sida/<n>/` (Swedish "sida" avoids slug collision with `[slug].astro` and reserves `/nyheter/<n>/` for any future numerically-slugged post). EN mirror at `/en/news/` + `/en/news/page/<n>/`. Inlined `PAGE_SIZE` inside `getStaticPaths` because Astro hoists it past module-level scope. 266 pages build clean.

### DONE: Post routes and listings
- **Tags:** frontend, routing
- **Last updated:** 2026-05-10
- **Done:** `/nyheter/` Swedish news listing and `/nyheter/<slug>/` per-post pages added. EN mirrors at `/en/news/` (currently empty until translations land). Home pages link to listings and ten most recent posts. The previously imported empty `nyheter.md` placeholder is dropped in the import script via `SKIP_PAGE_SLUGS`. 255 pages build clean.

---

*Updated: 2026-05-10*

