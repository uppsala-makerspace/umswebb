# Sidebar navigation

## Goal

Replace the current header-row primary nav with a left-rail sidebar at
desktop widths that collapses to a hamburger-triggered off-canvas panel
on mobile. Mirrors the umstutorial pattern, which fits the UMS web
family visually.

## Scope

- Persistent left sidebar at ≥ breakpoint, off-canvas drawer below it.
- Single content width already unified at `--content-width: 960px`; the
  sidebar takes ~240 px from that, leaving ~680 px for content
  (≈65 ch at 17 px font — comfortable for reading).
- Both Swedish and English navs (data already in `src/data/nav.ts`).
- Active page highlighting via `aria-current="page"` (already present).
- Theme toggle + language switcher move out of the header into the
  sidebar (or sit in a slim mobile header that the hamburger is also in).

## Decisions (push back if any of these are wrong)

| Decision                           | Choice                                  | Why                                                                                              |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Breakpoint                         | **768 px**                              | Industry standard tablet boundary; matches umstutorial.                                          |
| Sidebar width                      | **240 px**                              | Same as tutorial. With `--content-width: 960` and 40 px gap, content lands at ~680 px.           |
| Sidebar contents (top → bottom)    | brand · primary nav · theme toggle · lang switcher | Keeps everything in one column on desktop. Mobile header becomes very slim.                    |
| Mobile header                      | hamburger (left) · brand wordmark · theme toggle · lang switcher | Recognisable. Theme + lang stay reachable without opening the drawer.                            |
| Sidebar position                   | `position: sticky; top: 0`              | Stays visible while content scrolls; longer pages don't strand the user without nav.            |
| Off-canvas direction               | slides in from the **left**             | Matches sidebar position — no jarring direction flip when crossing the breakpoint.               |
| Backdrop                           | semi-transparent dim, click to close   | Standard mobile-drawer pattern.                                                                 |
| Body scroll lock                   | yes, while drawer open                 | Prevents background scroll bleed-through.                                                        |
| Focus trap                         | yes, inside drawer                     | Keyboard accessibility; on close, return focus to hamburger.                                     |
| Escape key                         | closes the drawer                      | Standard.                                                                                        |
| Footer                             | stays below content                    | Print-friendly; hidden via `@media print` along with sidebar.                                    |

## Layout sketch

Desktop (≥ 768 px):

```
┌─────────────────────────────────────────────────────────────────┐
│                          (no top header)                         │
├──────────┬──────────────────────────────────────────────────────┤
│ STAMP    │                                                      │
│ Uppsala  │                                                      │
│ Maker…   │                                                      │
│          │                                                      │
│ Start    │                                                      │
│ Nyheter  │              CONTENT (max ~680 px wide)              │
│ Lokalen  │                                                      │
│ Bli mdlm │                                                      │
│ Vanliga  │                                                      │
│ Kalender │                                                      │
│ Om oss   │                                                      │
│ Wiki ↗   │                                                      │
│          │                                                      │
│ ☀ / 🌙   │                                                      │
│ EN       │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
                          (footer)
```

Mobile (< 768 px):

```
┌─────────────────────────────────────────────────────────┐
│ ☰   Uppsala Makerspace                       🌙   EN   │   ← slim header (sticky)
├─────────────────────────────────────────────────────────┤
│                                                         │
│              CONTENT (full width minus padding)         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Drawer open:

```
┌─────────────┬──────────────── (dimmed) ─────────────────┐
│ STAMP    ✕  │                                            │
│ Uppsala…    │                                            │
│             │                                            │
│ Start       │           backdrop, click to close         │
│ Nyheter     │                                            │
│ ...         │                                            │
└─────────────┴────────────────────────────────────────────┘
```

## Phased implementation

**Phase 1 — markup + CSS grid**
- Restructure `BaseLayout.astro`: a `.app-shell` wrapper that's a CSS
  grid with `grid-template-columns: 240px 1fr` at ≥ 768 px, single
  column below. Sidebar `<aside>`, content `<main>`, footer below.
- The mobile header (hamburger + brand + dark/lang) only renders below
  the breakpoint via CSS.

**Phase 2 — drawer behaviour**
- Hamburger button toggles `data-nav-open` on `<html>` (or on the
  shell). CSS uses that attribute to translate the sidebar in/out.
- Backdrop element. Click to close.
- Inline JS in `BaseLayout.astro`:
  - Open/close the drawer.
  - Body scroll lock by toggling `overflow: hidden` on `<body>` when
    open.
  - Escape key closes.
  - Focus trap: when opening, focus first link; on Tab/Shift+Tab cycle
    inside drawer; on close, return focus to hamburger.

**Phase 3 — polish**
- Active link emphasis stronger (left-edge accent stripe in brand
  green).
- Hover/focus styling for keyboard users.
- `prefers-reduced-motion` disables the slide animation.
- Print: hide sidebar + drawer chrome.

## Open questions

- **Brand placement on mobile**: full wordmark "Uppsala Makerspace" or
  just the stamp icon? Wordmark feels cramped at tiny widths. Stamp
  alone risks being unrecognisable. Probably stamp + wordmark down to
  ~360 px, stamp only below.
- **Wiki external link**: the only nav item that's external. Keep the
  small ↗ glyph or just rely on the new-tab behaviour?
- **Secondary nav (Kontakt)**: stay in the footer, or move into the
  sidebar near the bottom? Currently in footer.

## References

- `umstutorial/site.css` — sidebar pattern, mobile drawer behaviour
- `src/layouts/BaseLayout.astro` — current implementation to replace
- `src/data/nav.ts` — nav data is already locale-aware, no schema
  changes needed
- `src/styles/global.css` — `--content-width: 960px` already targets
  this layout

## First step

Skim `umstutorial/site.css` for the exact drawer markup/CSS the
tutorial uses, then sketch the new `BaseLayout.astro` markup before
writing any code. Keep markup changes minimal — most of the work
happens in `global.css`.
