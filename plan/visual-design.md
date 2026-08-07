# Visual design and styling

## Direction agreed

- **Personality**: playful and approachable.
- **Baseline**: extend the `umstutorial` design system rather than diverge — keeps the UMS web family visually coherent (public site + tutorial + app screens).
- **Home page**: logo, two short intro paragraphs, then a carousel of workshops and interest groups pulled from the members API. The four-card destination grid this plan originally called for was built and then replaced; see `entries-api.md`.
- **Typography**: still the tutorial's system sans-serif stack. Revisit later — Inter / Atkinson Hyperlegible / a humanist sans are candidates once content has settled.
- **Dark mode**: user toggle, persisted in `localStorage`. System preference is the initial default. Theme decision must happen before paint to avoid FOUC, so an inline blocking script in `<head>` sets `data-theme` on `<html>` synchronously.
- **CSS approach**: vanilla CSS with custom properties. One global stylesheet for tokens + base + chrome, scoped `<style>` blocks per Astro component. No Tailwind, no Open Props — small site, low-fuss.

## Design tokens

Light mode (defaults; mirrors tutorial):

| Token                 | Value          | Notes                              |
| --------------------- | -------------- | ---------------------------------- |
| `--brand-green`       | `#22c55e`      | Primary accent (links, focus)      |
| `--brand-green-dark`  | `#16a34a`      | Primary hover, selected tag underline |
| `--brand-amber`       | `#f59e0b`      | Warm secondary, the "playful"; trial ribbon |
| `--brand-amber-soft`  | `#fef3c7`      | Notice background, hover tint      |
| `--text`              | `#111827`      |                                    |
| `--text-muted`        | `#4b5563`      |                                    |
| `--border`            | `#e5e7eb`      |                                    |
| `--bg`                | `#f9fafb`      | Page background                    |
| `--card`              | `#ffffff`      | Surface                            |
| `--shadow-sm`         | `0 1px 2px rgba(0,0,0,0.04)` |                       |
| `--shadow-md`         | `0 4px 12px rgba(0,0,0,0.06)` |                      |
| `--radius`            | `8px`          | Default corner radius              |
| `--radius-lg`         | `16px`         | Cards, hero imagery                |
| `--header-h`          | `64px`         | Mobile header only — no header on desktop |
| `--content-width`     | `1100px`       | Reference only; `.app-shell` and `.layout` set the real widths |

Dark mode (`[data-theme="dark"]`):

| Token             | Value     |
| ----------------- | --------- |
| `--text`          | `#f3f4f6` |
| `--text-muted`    | `#9ca3af` |
| `--border`        | `#2c3133` |
| `--bg`            | `#0d1110` |
| `--card`          | `#171c1b` |
| `--brand-green`   | `#34d399` (lighter for contrast on dark) |
| `--brand-green-dark` | `#6ee7b7` — note it *lightens* in dark mode, so anything painted on it needs `var(--card)` as its text colour, not white |
| `--brand-amber-soft` | `#3a2a08` |

## Layout

- **Desktop (≥ 768 px)**: no header. `.app-shell` is a 280 px + 828 px grid with a 40 px gap, `max-width` set to their sum and `margin: 0 auto`, so menu and content are centred together. Brand at the top of the sidebar, theme + language at the bottom above a rule. See `sidebar-nav.md`.
- **Mobile (< 768 px)**: slim sticky header (hamburger, theme, language) and an off-canvas drawer.
- **Main**: `.layout` caps the content column at 828 px (780 px visible inside its padding); `prose` adds the reading typography for content pages.
- **Footer**: none exists. The old WP "Kontakt" menu item therefore has no home — open item.

## Home page

Both `/` and `/en/` are hand-built and identical in structure:

1. `.home-masthead` — the complex logo, centred, max 480 px, `invert(1)` in dark mode. An `h1` is present but visually hidden (the logo is the visible title).
2. `.home-intro` — two centred paragraphs at full column width so they line up with the cards. Copy names the association and the space, then links to the calendar, the space and membership.
3. `<EntryCarousel>` — workshops and interest groups, one card at a time. Details in `entries-api.md`.

No news on the home page any more; the listing is reachable from the menu.

## News listing

`.news-list` in `global.css` is the shared row layout: date column (`min-width: 7em`, tabular numerals, muted) then the title link, rows separated by hairlines. Used by all four listings (`/nyheter/`, `/nyheter/sida/<n>/`, `/en/news/`, `/en/news/page/<n>/`). Below 460 px the row becomes a block so the date sits on its own line — the fixed date column left too little for the long post titles.

## Status

**Phase 1 — Foundation** *(done)* — tokens, reset, base typography, prose container, theme init + toggle.

**Phase 2 — Home** *(done, then rebuilt)* — the stamp-logo + tagline hero and four-card grid shipped first, then were replaced by the current logo + intro + carousel. `home-cards.ts` and the `.home-hero` / `.card-grid` / `.card-news` rules have been deleted; `.notice` survives because content pages use it.

**Phase 3 — Content polish** *(next)* — headings, lists, blockquotes, code and image figures inside the prose container; news post pages.

**Phase 4 — Iterate** *(later)* — try Inter / Atkinson Hyperlegible / a humanist sans against the system stack. Decide on imagery beyond the workshop photos: a photo of the space on the home page? Photos in news teasers?

## Open questions

- Tagline copy: the home page currently has **no** tagline (it was dropped when the intro text landed), but `<meta name="description">` still says "skapa, lär, dela." / "make, learn, share." Keep, or align?
- Footer: add one for Kontakt and copyright, or leave the site footerless?
- Centred intro text at 780 px is a long measure for centred copy — consider left-aligning it.
- The sidebar's full-height divider runs from viewport top to bottom now that the layout is centred; a shorter rule, or none, may sit better.

## Reference files

- `umstutorial/site.css` — design source we're extending
- `src/styles/global.css` — tokens, chrome, prose, `.news-list`
- `src/pages/index.astro`, `src/pages/en/index.astro` — the two home pages
- `src/components/EntryCarousel.astro`, `src/components/EntryCard.astro`
- `public/icons/Logos/SVG/Logo_Complex_Black.svg` — home page logo
- `public/Stamp/SVG/Makerspace stamp.svg` — brand mark in the sidebar
