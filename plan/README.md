# Plans

The roadmap for the bilingual rebuild of uppsalamakerspace.se on Astro.
Tackle one plan at a time. When picking up a plan, run
`/roadmap resume "plan name"`.

---

### ONGOING: Visual design and styling
- **Tags:** frontend, design
- **Depends on:** —
- **Last updated:** 2026-08-06
- **Done:** Direction captured in `visual-design.md`. **Phase 1 (foundation)**: `src/styles/global.css` with light + dark tokens (extends tutorial palette with warm amber accent), reset, base type, prose container. `BaseLayout.astro` rewritten as an app shell, prose-vs-wide layout switch via a `prose` prop. Inline pre-paint theme-init script + post-load toggle handler (no FOUC). **Phase 2 (home)**: superseded — the four-card grid was replaced by the API-driven carousel, see *Workshops and groups from the members API*. Both home pages are now logo + two intro paragraphs + carousel; `.home-masthead` / `.home-intro` are the only home-specific rules left in `global.css`, and `home-cards.ts` plus the `.home-hero` / `.card-grid` / `.card-news` rules are deleted. **News listing**: the date-column-then-title row layout was extracted from the old home card into a shared `.news-list` class and applied to all four listings (`/nyheter/`, `/nyheter/sida/<n>/`, `/en/news/`, `/en/news/page/<n>/`); below 460 px the date moves to its own line.
- **Next step:** **Phase 3 (content polish)** — review imported pages and posts in the new prose container; tune headings, lists, image sizing, code blocks, table styles. **Phase 4 (typography iteration)** — experiment with Inter / Atkinson Hyperlegible / a humanist sans against the system stack. Also unresolved: there is no site footer at all (`BaseLayout` renders none) and `nav.ts` has no `secondaryNav`, so the Kontakt link from the old WP menu is currently unrendered — decide whether to add a footer or drop it.
- **Details:** `visual-design.md`

### ONGOING: Workshops, groups and the floor map from the members API
- **Tags:** frontend, integration, content
- **Depends on:** —
- **Last updated:** 2026-08-06
- **Done:** `src/lib/entries.ts` fetches `/api/public/entries` at build time (`UMS_API_URL`, default `http://localhost:3000/...`) and validates `{ entries, spaces, palette }` with Zod. The load is **memoised on module scope** so fetching, asset caching and pruning happen once per build — the prune deletes everything in the cache directory the response doesn't reference, so two independent loads would delete each other's files. `getEntries()` returns the carousel's subset (`kind: "workshop"` plus `kind: "group"` with `type: "interest"`, workshops first); `getFloorMap()` returns both floors with every room, resolving each room's workshop and groups against *all* entries. Assets land in `public/ums-data/`, named from the `v=` version stamp so an unchanged asset is a cache hit; photos are downscaled to 1200 px via ImageMagick (original kept if `magick` is missing). The two floor plans come from the member app (`UMS_APP_URL`, default `http://localhost:3001`), have no version stamp so they're re-fetched each build, and must be same-origin for `<object>` to expose `contentDocument`. Alt text is generated since the API carries none, and Markdown in `text` is rendered via `src/lib/richtext.ts`. Components: `EntryCard.astro` (icon plate, photo, kind label, "På prov" ribbon), `EntryCarousel.astro` (shared by `/` and `/en/`), and `FloorMapEmbed.astro` — the map on `/lokalen/` and `/en/our-space/`, embedded from markdown as `<div data-floor-map>` and rendered only on pages whose body contains it.
- **Next step:** Point `UMS_API_URL` and `UMS_APP_URL` at the real hosts and decide how CI builds reach them — the build needs both, and no API means no build. Then: proofread the English copy on `/en/` and `/en/our-space/`, get "Ceramics woorkshop" fixed in the API, and decide what to do about wildly uneven `text` lengths (Träverkstaden has five paragraphs of workshop rules, Keramikverkstaden has one word) — probably a short summary field. Also decide whether `public/ums-data/` is committed or gitignored.
- **Details:** `entries-api.md`

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

### DONE: Sidebar navigation
- **Tags:** frontend, accessibility, mobile
- **Last updated:** 2026-08-06
- **Done:** `BaseLayout.astro` is an app shell: `.app-shell` is a CSS grid at ≥ 768 px, an off-canvas drawer below. **Desktop has no header at all** — `.site-header` is `display: none` there, the brand wordmark sits at the top of the sidebar and the theme + language controls at the bottom of it above a rule (`.sidebar-footer`, a second copy of the controls; the mobile header keeps its own). Sidebar is 280 px (not the planned 240) so "Uppsala Makerspace" fits on one line beside the stamp, and it's `position: sticky; top: 0; height: 100vh` with a transparent background so it reads as a column rather than a panel. Menu and content are centred together: `.app-shell` has `max-width: calc(280px + 40px + 828px)` and `margin: 0 auto`. Mobile: slim sticky header (hamburger + theme + lang), left-sliding drawer with backdrop, body scroll lock, focus trap, Escape to close, `prefers-reduced-motion` respected, chrome hidden in print. Open questions resolved: the wordmark is only in the sidebar now so the mobile-width truncation rules were dropped; the Wiki link keeps its ↗ glyph; Kontakt has no home yet since there is no footer (tracked under *Visual design and styling*).
- **Details:** `sidebar-nav.md`

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
- **Superseded (2026-08-06):** both home pages are now hand-built (logo + intro + API carousel). `start.md` moved to `_deprecated/` and is no longer part of the collection, `RESERVED_SLUGS` is gone from `[...slug].astro`, and neither home page reads the content collection.

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

*Updated: 2026-08-06*

