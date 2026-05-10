# Visual design and styling

## Direction agreed

- **Personality**: playful and approachable.
- **Baseline**: extend the `umstutorial` design system rather than diverge — keeps the UMS web family visually coherent (public site + tutorial + app screens).
- **Home page**: logo on top, then a four-card grid linking to the most common destinations. The body of `start.md` is no longer rendered on `/` (the cards replace its role; the file stays in the collection and its `description` still feeds `<meta>`).
- **Typography**: start with the tutorial's system sans-serif stack. Revisit later — Inter / Atkinson Hyperlegible / a humanist sans are candidates to try once we can compare side by side.
- **Dark mode**: user toggle in the header, persisted in `localStorage`. System preference is the initial default. Theme decision must happen before paint to avoid FOUC, so an inline blocking script in `<head>` sets `data-theme` on `<html>` synchronously.
- **CSS approach**: vanilla CSS with custom properties. One global stylesheet for tokens + base, scoped `<style>` blocks per Astro component. No Tailwind, no Open Props — small site, low-fuss.

## Design tokens

Light mode (defaults; mirrors tutorial):

| Token                 | Value          | Notes                              |
| --------------------- | -------------- | ---------------------------------- |
| `--brand-green`       | `#22c55e`      | Primary accent (links, focus)      |
| `--brand-green-dark`  | `#16a34a`      | Primary hover                      |
| `--brand-amber`       | `#f59e0b`      | New: warm secondary, the "playful" |
| `--brand-amber-soft`  | `#fef3c7`      | Card hover background tint         |
| `--text`              | `#111827`      |                                    |
| `--text-muted`        | `#4b5563`      |                                    |
| `--border`            | `#e5e7eb`      |                                    |
| `--bg`                | `#f9fafb`      | Page background                    |
| `--card`              | `#ffffff`      | Surface                            |
| `--shadow-sm`         | `0 1px 2px rgba(0,0,0,0.04)` |                       |
| `--shadow-md`         | `0 4px 12px rgba(0,0,0,0.06)` |                      |
| `--radius`            | `8px`          | Default corner radius              |
| `--radius-lg`         | `16px`         | Cards, hero imagery                |
| `--header-h`          | `64px`         | A bit roomier than the tutorial    |
| `--prose-width`       | `72ch`         | Readable column for body content   |

Dark mode (`[data-theme="dark"]`):

| Token             | Value     |
| ----------------- | --------- |
| `--text`          | `#f3f4f6` |
| `--text-muted`    | `#9ca3af` |
| `--border`        | `#2c3133` |
| `--bg`            | `#0d1110` |
| `--card`          | `#171c1b` |
| `--brand-green`   | `#34d399` (lighter for contrast on dark) |
| `--brand-amber-soft` | `#3a2a08` |

## Layout

- **Header** (sticky, `--header-h`): logo (Simple variant, small), primary nav, language switcher (pill style from tutorial), dark mode toggle.
- **Main**: 1100 px max for landing/cards, prose-width (72ch) for content pages.
- **Footer**: secondary nav (Kontakt), copyright. Room later for social icons.

## Home page card grid

Four cards. Each card: large icon/emoji (or stamp variant), label, one-line blurb, links to a primary destination.

| Card    | SV link            | EN link              | Icon idea           |
| ------- | ------------------ | -------------------- | ------------------- |
| Visit   | `/lokalen/`        | `/en/our-space/`     | door / pin          |
| Join    | `/bli-medlem/`     | `/en/bli-medlem/`    | membership card     |
| News    | `/nyheter/`        | `/en/news/`          | newspaper           |
| Make    | `/aktiviteter/`    | `/en/aktiviteter/`   | wrench / spark      |

Logo on top: use the round **Stamp** (`public/Stamp/SVG/Makerspace stamp.svg`) at ~120 px, centered. Below: site title and a one-line Swedish/English tagline. Then the cards.

## Phased implementation

**Phase 1 — Foundation** *(this session)*
- Add `src/styles/global.css` with tokens (light + dark), reset, base typography, link styles, prose container.
- Update `BaseLayout.astro`: import global.css, render new header (logo + nav + switcher + dark toggle), render new footer, prose container around `<slot/>`.
- Add inline theme-init script in `<head>` to set `data-theme` from localStorage / system preference before paint.
- Add a small client script for the toggle button.

**Phase 2 — Home** *(this session)*
- Replace `start.md` body rendering on `/` with: stamp logo + title + tagline + card grid.
- Mirror in `/en/`.
- News list moves below the cards (kept; just smaller / quieter visually).

**Phase 3 — Content polish** *(next session)*
- Style headings, lists, blockquotes, code in prose container.
- Image figure styling.
- News listing visual polish.

**Phase 4 — Iterate** *(later)*
- Try Inter / Atkinson Hyperlegible / a humanist sans against the system stack — do this once content has settled.
- Decide on imagery: hero photo of the space? Photos in news teasers?

## Open questions for later

- Tagline copy — Swedish + English. (Suggested SV: "Skapa, lär, dela." EN: "Make, learn, share." — placeholder until you confirm.)
- Card icons — emoji is fine for now; replace with custom illustrations later if budget/effort allows.
- Should secondary nav (Kontakt) live in the footer only, or also as a small header-end link?

## Reference files

- `umstutorial/site.css` — design source we're extending
- `public/Stamp/SVG/Makerspace stamp.svg` — round logo for the home hero
- `public/icons/Logos/SVG/Logo_Simple_Black.svg` — wider mark for the header
