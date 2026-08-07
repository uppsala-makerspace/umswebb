# The photo pile on the home page

Drop a picture in this folder and add an entry to `photos.json`. Nothing in the
component needs touching — it reads the folder and the file. Rendered by
`src/components/PhotoPile.astro`.

```json
{
  "file": "sewing.jpg",
  "alt": { "sv": "…", "en": "…" },
  "wide":   { "x": 3, "y": 8, "width": 42, "rotate": -5 },
  "narrow": { "x": 0, "y": 2, "width": 62, "rotate": -4 }
}
```

- **`file`** — the filename in this folder. Case-sensitive.
- **`alt`** — what the picture shows, in both languages. Not decorative: describe
  it for someone who cannot see it, and keep it to a sentence.
- **`wide`** / **`narrow`** — where the print lands, on screens above and below
  640 px. Two arrangements are needed because the wide one shrinks every picture
  to a stamp on a phone.
  - `x`, `y` — the top-left corner, in per cent of the pile's box.
  - `width` — in per cent of the pile's width. The height follows from the
    picture's own proportions.
  - `rotate` — degrees. Small values, a few either way; the point is that nothing
    lines up.

**Array order is stacking order**: the first entry lies at the bottom, the last
on top. Reorder the array to change what overlaps what — and which picture is
seen first, since the pile then cycles from there.

The pile cycles by itself: every three seconds the print on top is dealt to the
bottom, bringing out the one beneath, around and around. So the array order is
also the order the pictures take their turn in. The interval is the `cycleMs`
prop on `<PhotoPile>` in `src/pages/index.astro`. Cycling pauses while the
pointer is over the pile, while something in it has focus, while it is scrolled
out of view, and entirely for a visitor who has asked for reduced motion.

Dealt, not merely restacked: the print slides clear of the pile, the order changes
underneath it while nothing overlaps, and it slides back in at the bottom. It goes
**downwards**, with a small sideways lean away from the middle. Downwards because
that is the only direction with room — sideways, a print at the edge of the column
either pushes the page into horizontal scrolling or is cut off by the viewport, so
the lean is dropped entirely for any print whose `x` and `width` put it against an
edge. All of that is worked out from the placement you write here; there is
nothing to set.

The two legs take 220 ms and 260 ms; those live in both the script and the
stylesheet of `PhotoPile.astro` and have to be changed together. Keep `cycleMs`
comfortably above their sum — a shorter interval simply skips a turn rather than
starting a second deal mid-flight.

The pile's box is 1.9:1 on wide screens and 3:4 on narrow ones, so `y: 100` is
its bottom edge. Rotated corners are allowed to reach outside it — nothing is
clipped — but keep an eye on the widest picture so the page does not gain a
horizontal scrollbar.

A picture with no entry in `photos.json` is skipped, and an entry naming a file
that is not here is skipped too; both print a warning during the build rather
than failing it.
