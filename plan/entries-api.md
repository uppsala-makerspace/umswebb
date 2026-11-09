# Workshops, areas of interest and the floor map from the members API

## Goal

Show the association's workshops ("verkstäder") and areas of interest
("intresseområden") on `/vad-vi-gor/`, and a map of the space on `/lokalen/`, sourced from the members service
rather than maintained as content files. The site is static, so everything
happens at build time — including copying the API's images and the member app's
floor plans into the build so the published site never points at another host.

`umsme/docs/public-api.md` is the contract. Read it before changing
anything here.

## The API

`GET {UMS_API_URL}` — default `http://localhost:3000/api/public/entries`, override
with the environment variable. One call carries everything: `entries`, `spaces`
and `palette`.

```json
{
  "entries": [
    {
      "id": "traverkstaden",
      "kind": "workshop",              // or "areaOfInterest" | "group"
      "status": "established",         // workshops, areas: "established" | "trial"
      "type": "function",              // groups only, always "function"
      "name": { "sv": "Träverkstaden", "en": "Wood workshop" },
      "tag":  { "sv": "Trä", "en": "Wood" },
      "icon": "http://…/icon?v=2026%2Fspace-<id>-<ms>.svg",
      "image": "http://…/image?v=2026%2Fworkshop-<id>-<ms>.jpg",
      "text": { "sv": "Markdown…", "en": "Markdown…" },
      "spaces": [
        { "spaceId": "woodworkshop", "floor": "floor1", "role": "primary", "color": "green" }
      ]
    }
  ],
  "spaces": [
    {
      "spaceId": "woodworkshop",       // matches the SVG element ids
      "floor": "floor1",               // "floor1" | "floor2"
      "name": { "sv": "Träverkstad", "en": "Wood Workshop" },
      "text": { "sv": "…", "en": "…" },
      "icon": "http://…/icon?v=…svg",
      "iconSize": 450,                 // SVG user units, not px
      "workshop": "traverkstaden",     // an entry id, at most one
      "areasOfInterest": ["lordagskurser"],
      "groups": ["trivselgruppen"]
    }
  ],
  "palette": { "green": "#5fc86f", "blue": "#5fa8c8", "amber": "#e0b64f",
               "purple": "#b18fd0", "coral": "#e08a6f" }
}
```

Field notes worth remembering:

- `icon` is an **SVG URL**, drawn in black — not an emoji. It sits on a white
  plate in the card so it needs no dark-mode inversion.
- `image` and `icon` are both optional. Bokbindarverkstaden has no photo, Bike
  kitchen has neither.
- **No alt text.** We generate "Illustrativ bild för <namn>" / "Illustrative image
  for <name>".
- `text` is Markdown with blank-line paragraphs and `**bold**`.
- Photos arrive at full resolution — the first one measured was 1.8 MB.
- Asset URLs carry a `v=` version stamp whose basename is unique per version.
- **`spaceId` is only unique per floor.** `kitchen`, `entrance` and `boxstorage`
  exist on both, with different texts. The key is always the pair
  `(spaceId, floor)` — selection, icon lookup and colouring all carry both.
- **The floor plans are not in the API.** They're static assets of the member app:
  `{UMS_APP_URL}/images/floor{1,2}.svg`, default `http://localhost:3001`. Each room
  appears twice: `<spaceId>-floor` (the polygon) and `<spaceId>-marker` (a circle
  with `cx`/`cy`, a placeholder for the icon).
- **The drawings contain elements with no matching space** (`ventilationshaft`,
  `ventilation_shaft`). Tolerate them.

## Implementation

**`src/lib/entries.ts`** — the only module that knows where the data comes from.

- `loadPublicData()` is **memoised on module scope**, so the fetch, the asset
  caching and the prune happen exactly once per build no matter how many pages
  ask. This is not an optimisation: the prune deletes everything in the cache
  directory the response doesn't reference, so two independent loads would delete
  each other's files.
- Validates with Zod — a bad payload fails the build with a field-level error
  instead of rendering empty cards.
- Bilingual fields may lack `sv` or `en`; the schema fills a missing language
  from the other, so components can always index by locale.
- `getEntries()` returns what the carousel shows: `kind: "workshop"` and
  `kind: "areaOfInterest"`, workshops first. Groups are all function groups (IT,
  Kiosk) — internal working groups — and stay out. `getFloorMap()` returns the
  two floors with every room, and resolves each room's workshop, areas of interest
  and groups against **all** entries — a room can name IT-gruppen even though the
  carousel doesn't.
- Caches assets into `public/ums-data/`, named from the `v=` stamp: the file
  existing *is* the cache hit, and a new version arrives under a new name. The
  name is validated against `^[\w.-]+$` so remote data can't write outside the
  directory. Only presented entries get their card assets cached — a photo for
  IT-gruppen would be ~180 kB nothing displays.
- The floor plans have no version stamp, so they're re-fetched and overwritten
  every build (9.6 kB + 8.3 kB). They **must** be served from our own origin:
  `<object>` only exposes `contentDocument` — which is how rooms get coloured and
  clicked — when it is same-origin.
- Photos are downscaled to 1200 px / quality 82 with sharp — the same library
  Astro's own image pipeline uses, so the build needs nothing installed on the
  machine beyond `pnpm install`.
- Prunes anything in the cache directory the current response doesn't reference —
  stale versions and dropped entries. **The directory is owned by the loader; do
  not put anything else there by hand.**
- Astro copies `public/` into `dist/` *before* pages render, so the files the
  loader writes during the build would miss it. A small integration in
  `astro.config.mjs` copies `public/ums-data/` into the output on
  `astro:build:done`.

**`src/lib/richtext.ts`** — `toParagraphs()` splits on blank lines, converts
`**bold**` after HTML-escaping, and turns bare `http(s)` URLs into links (event
descriptions carry their sign-up links that way). URLs are split out *before*
escaping, and trailing sentence punctuation stays outside the link. Anything
else in the Markdown shows literally rather than being silently dropped.

**`src/components/EntryCard.astro`** — white icon plate flush with the card's
top-left corner (rounded 10 px only on the inner corner, sized from
`--vk-icon-size` + `--vk-icon-inset`, in flow so the header is as tall as the
plate), title, kind label ("Verkstad" / "Intresseområde", from `kind`), 16:10 photo, then the text. `status: "trial"` adds an
amber corner ribbon reading "På prov" / "Trial".

**`src/components/EntryCarousel.astro`** — the whole carousel, shared by `/` and
`/en/`, with every string in a `LABELS` map keyed by locale:

- One card per view. The track is a native `scroll-snap` container, so swipe,
  trackpad and arrow keys work with no JavaScript; without JS the section is
  simply a scrollable row.
- **Tags** above the track (plain text, no chrome) name every entry up front and
  jump to its card. The selected one goes from muted to full-strength text plus a
  green underline — no weight change, because bold is wider and the row would
  jitter as autoplay moves the selection.
- **Chevrons** on a translucent disc, revealed only when the pointer is in the
  left or right third (a `pointermove` handler sets `data-hover`), hidden at the
  ends, and only at `(min-width: 768px) and (hover: hover)` so touch devices get
  swipe instead.
- **Autoplay** every 2 s, wrapping to the first card with an instant jump, and
  stopped for good by the first interaction (`pointerdown`, `wheel`,
  `touchstart`, `keydown`, `focusin`). Disabled under `prefers-reduced-motion`.
- ARIA: `aria-roledescription` on the section and each slide, `aria-current` on
  the selected tag, `aria-label` with position ("2 av 4: Keramikverkstaden").

**`src/components/FloorMapEmbed.astro`** — the map on `/lokalen/` and
`/en/our-space/`. Follows the member app's `FloorMap` component rather than
reinventing it. Embedded from markdown as `<div data-floor-map></div>`, the same
placeholder pattern as `data-gallery`; the routes render the component only when
`page.body` contains the attribute, so other content pages don't carry the JSON
blob and the script.

The skeleton lives in a `<template>` so it can be server-rendered and translated
in Astro instead of built in JavaScript; the script clones it into the placeholder.
Three techniques are lifted from the app, and each exists for a reason:

- **Icons go in as `<image href="…">`**, never inlined, centred on the marker
  (`x = cx - size/2`). That keeps them vector while sandboxing them, so an icon's
  own styles cannot bleed into the floor plan. `iconSize` is in SVG user units —
  450 on floor 1, 140 on floor 2 — because the drawings have very different scales.
- **The pulse is `@keyframes` with only a `50%` step**, injected into the SVG
  document. It animates from the room's own fill and back, so we never need to know
  the base colour. `select()` re-runs it for *both* floors: the clearing pass lives
  inside it, so the room picked before switching floors stops pulsing behind.
- **The rooms keep the drawing's own pastel fills.** Colour is used only as the
  pulse — the palette-per-space colouring is the app's *mini* map, for a single
  workshop's page.

A room list under the map mirrors the active floor as buttons: the SVGs live in
their own documents via `<object>`, so rooms are unreachable by keyboard otherwise.

## The calendar

`/kalender/` and `/en/calendar/` list the occasions from the same response —
the Google Calendar embed is gone. `getOccasions()` merges the `events` of every
`kind: "activity"` entry with the free-standing top-level `events`, resolving
category, room name and workshop, soonest first. An activity's event takes its
name and room from the activity unless it carries its own.

**`src/components/OccasionList.astro`** groups them by month, with dates and
times rendered at build time in `Europe/Stockholm`. A cancelled occasion stays
listed, struck through with an "Inställt" badge. Each item's `id` is a DOM
anchor (`#oppet-i-lokalen-202611111700`) for linking to a single occasion. A
small script removes what has ended since the build and shows the empty-state
text when nothing is left.

Each occasion is three lines: the title with its sign-up top right; the time
and place with, right-aligned, the hosts' first names when umsme publishes them
("Ansvariga: Anna och Bo"); and the description.

- **Sign-up** is a clipboard icon — filled when `required`, outlined when
  `optional` — with the seats as "3/8", or "Fullt" at `seatsLeft: 0`. The full
  sentence ("Anmälan krävs · 3 av 8 platser kvar") is its tooltip and its
  screen-reader text. A cancelled occasion shows none. The seats are as of the
  hourly build, not live. The icon is `RegistrationIcon.astro`.
- **A phone has no hover**, so an occasion with sign-up always folds out, and
  its unfolded text ends with the icon and that sentence in words, followed
  by "Anmälan görs i appen för medlemmar." (the app as the menu names it; no
  link by choice). The tooltip and screen-reader text say the same. With no
  description there is nothing else to fold out, so that line shows directly.
- **The description** folds to one line with an ellipsis, and a chevron folds
  it out (as does a click on the text, links excepted). The script only adds
  the chevron where the text overflows that line, re-checked on resize, so a
  short description gets none. Without JS the whole text shows.
The activities page shows the activity's own `registration` and `seats`. There
is no sign-up link in the API yet; sign-up links in descriptions are made
clickable by `toParagraphs()`.

Only what umsme marks *shown on the website* reaches the API: an activity's
events inherit the flag from the activity, and free-standing events need it
themselves. Unpublished data simply doesn't appear — check the flags first when
the calendar looks empty.

The intro on the calendar links to **`/aktiviteter/`** and **`/en/activities/`**
(`ActivityList.astro`, `getActivities()`): every published activity sorted by
name, with category, room, duration, members only and cost, its description,
and a link to its next non-cancelled occasion in the calendar. An activity's
`image` is shown as a square thumbnail, cached at 480 px rather than the
1200 px of the carousel photos (`cacheAsset(…, THUMB_WIDTH)`; the file gets a
`-w480` suffix). The anchor
comes from `occasionId()`, shared with `getOccasions()`, so the two can't
drift. The page is not in the menu yet.

Under the description an occasion unfolds its photo — a free-standing event's
own, else its activity's — and an occasion with a photo always folds out, like
one with sign-up. The calendar uses a 960 px copy (`-w960`, made only for
activities with occasions to come); the activities page keeps its 480 px
thumbnail. Hidden while folded, the lazy photo is mostly not fetched until
unfolded — except for occasions near the top, which can start loading before
the script folds them.

**`CalendarSubscribe.astro`** renders the page heading with a calendar icon
on the right; it folds out a panel (open without JS) offering the association's
Google calendar ("UMS Evenemangskalender") to add to one's own: Google Calendar
(`render?cid=`), Apple Calendar and other apps (`webcal://`), Outlook.com
(`addfromweb`), and copying the iCal address. umsme mirrors exactly the
published occasions there (`calendarEntry()` skips unpublished ones), so it is
the same content, kept current by the visitor's app. The calendar id is in the
component; it is umsme admin's `private.googleCalendar.calendarId`. A local
umsme without a `serviceAccount` only imports from it, never writes.

Not yet used: `group` and `category` (no data has them yet), and the
`categories` list for filtering. Whether each activity gets a page of its own
is undecided.

## Fragile bits

- `--ec-card-head: 118px` in the carousel duplicates the card's header height so
  the chevrons can be centred on the photo (`calc(head + 31.25cqw)`, using a
  container query on the card's width). Change the icon plate size and this needs
  changing too.
- The chevron offset assumes a one-line title; a wrapping title pushes the photo
  down and the chevron sits slightly high on that card.
- `.fm-floor` needs `inset: 0` and `width/height: 100%` on the `<object>`. With a
  content-driven size the replaced element falls back to its intrinsic size and the
  drawing gets cropped by the frame instead of scaled down — floor 1 is
  1610 × 3425 user units, so it is much taller than any sensible frame.

## Left to do

1. ~~Point the build at the real hosts~~ — done: `deploy/` rebuilds hourly against
   the production API in a container, and a failed build leaves the previous
   site up (see `deploy/README.md`). `public/ums-data/` is gitignored.
2. Proofread the English intro copy on `/en/` (written here, not translated by a
   human), and the English body of `/en/our-space/`, which is still a placeholder
   with the map bolted on.
3. Get "Ceramics woorkshop" fixed in the API.
4. Uneven `text` lengths: Träverkstaden has five paragraphs of workshop rules,
   Keramikverkstaden has one word. Cards in a row are as tall as the tallest, so
   the carousel is dominated by the longest text — probably wants a short summary
   field in the API, with the full text on a per-entry page.
5. Each entry already has a stable `id` used as the card's DOM id, and the map's
   panel already has the workshop and group names — the hook for linking rooms to
   per-entry pages once those exist.
6. The 29 space icons are ~360 kB and load as ~15 separate requests per floor.
   Worth measuring before optimising (svgo, or a sprite).
