# Sidebar navigation

**Status: done.** This file records what was built, and where it departs from the
original plan.

## Goal

Replace the header-row primary nav with a left-rail sidebar at desktop widths
that collapses to a hamburger-triggered off-canvas panel on mobile. Mirrors the
umstutorial pattern, which fits the UMS web family visually.

## What shipped

| Decision                        | Planned                          | Built                                                                                 |
| ------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Breakpoint                      | 768 px                           | 768 px — unchanged.                                                                    |
| Sidebar width                   | 240 px                           | **280 px**, so "Uppsala Makerspace" fits on one line beside the stamp (`white-space: nowrap`). |
| Desktop header                  | none                             | none — `.site-header { display: none }` at ≥ 768 px.                                    |
| Sidebar contents (top → bottom) | brand · nav · theme · lang       | as planned: brand wordmark, primary nav, then `.sidebar-footer` with theme + language above a `border-top`. `nav.primary { flex: 1 }` pushes the footer down. |
| Mobile header                   | hamburger · brand · theme · lang | **hamburger · theme · lang** — the brand moved into the sidebar for both breakpoints, so the association name is only visible on mobile once the drawer is open. |
| Shell placement                 | sidebar at the viewport edge     | **menu + content centred together**: `.app-shell` has `max-width: calc(280px + 40px + 828px)` and `margin: 0 auto`. |
| Sidebar background              | card surface                     | **transparent** on desktop (`background: none`), so it reads as a column next to the content rather than a panel starting mid-page. The card surface stays for the mobile drawer. |
| Sidebar position                | `sticky; top: 0`                 | `sticky; top: 0; height: 100vh` — nothing is pinned above it any more. |
| Off-canvas direction            | from the left                    | as planned.                                                                            |
| Backdrop / scroll lock / focus trap / Escape | yes               | all as planned, `prefers-reduced-motion` disables the slide, print hides the chrome.    |
| Footer                          | below content, holds Kontakt     | **not built** — there is no `<footer>` and no `secondaryNav` in `nav.ts`. Kontakt is unrendered. |

Two knock-on changes from removing the desktop header: `scroll-padding-top` drops
from `--header-h + 16px` to `16px` at that breakpoint (anchor links were
overshooting), and `.layout` gets 32 px of top padding instead of 24 so content
doesn't touch the viewport edge.

The theme and language controls exist twice in the DOM, once per breakpoint, with
CSS hiding the copy that doesn't apply. No script changes were needed: the theme
toggle already bound every `[data-theme-toggle]` and synced every icon. The
drawer's focus trap filters on `offsetParent !== null`, so the hidden desktop
copy stays out of the mobile tab order.

## Layout

Desktop (≥ 768 px) — the whole block is centred, with equal margins either side:

```
        ┌──────────┬──────────────────────────────────────┐
        │ STAMP    │                                      │
        │ Uppsala  │                                      │
        │ Maker…   │                                      │
        │          │                                      │
        │ Start    │                                      │
        │ Vår lokal│      CONTENT (max 780 px visible)    │
        │ Bli mdlm │                                      │
        │ Kalender │                                      │
        │ Nyheter  │                                      │
        │ Vanliga  │                                      │
        │ Om oss   │                                      │
        │ ── ext ──│                                      │
        │ App ↗    │                                      │
        │ Wiki ↗   │                                      │
        │ ─────────│                                      │
        │ 🌙  EN   │                                      │
        └──────────┴──────────────────────────────────────┘
             280 px            40 px gap
```

Mobile (< 768 px):

```
┌─────────────────────────────────────────────────────────┐
│ ☰                                            🌙   EN   │   ← slim header (sticky)
├─────────────────────────────────────────────────────────┤
│              CONTENT (full width minus padding)         │
└─────────────────────────────────────────────────────────┘
```

Drawer open — the brand is the first thing in it:

```
┌─────────────┬──────────────── (dimmed) ─────────────────┐
│ STAMP       │                                            │
│ Uppsala…    │                                            │
│ Start       │           backdrop, click to close         │
│ Vår lokal   │                                            │
│ ...         │                                            │
└─────────────┴────────────────────────────────────────────┘
```

## Resolved open questions

- **Brand placement on mobile** — moot: the wordmark lives in the sidebar only,
  so the truncation and 360 px-and-below rules were deleted.
- **Wiki external link** — keeps the small ↗ glyph, plus `target="_blank"` and
  `rel="noopener"`. External items are separated from internal ones by a hairline
  `.nav-separator` that `BaseLayout` inserts at the first external entry.
- **Secondary nav (Kontakt)** — unresolved, because no footer was built. Tracked
  under *Visual design and styling* in `README.md`.

## Left to decide

- The sidebar's `border-right` now runs the full viewport height in the middle of
  a centred layout. A shorter rule, or none, may sit better.
- With `height: 100vh` and eleven nav items plus brand and footer, a short window
  scrolls the menu internally and the theme/language row scrolls out of view
  rather than staying pinned at the bottom.

## References

- `src/layouts/BaseLayout.astro` — the app shell, drawer script, theme script
- `src/styles/global.css` — chrome CSS; desktop rules are in the
  `@media (min-width: 768px)` block
- `src/data/nav.ts` — locale-aware nav data, `primaryNav` only
