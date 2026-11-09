import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { z } from 'astro:content';
import type { Locale } from '../data/nav';

// Everything the site needs from the members service comes from one call, at
// build time: the workshops and areas of interest we present, plus every room on the two
// floor plans. Their icons, photos and the floor plans themselves are copied
// into `public/ums-data/` so the built site serves its own assets and never
// points at the API host.
//
// See `umsme/docs/public-api.md` for the contract. Three things from it that
// shape the code below: keys are absent rather than null, either language of a
// bilingual field may be missing, and `spaceId` is
// only unique per floor — `kitchen`, `entrance` and `boxstorage` exist on both,
// so the key is always the pair (spaceId, floor).
const API_URL = process.env.UMS_API_URL ?? 'http://localhost:3000/api/public/entries';

// The floor plans are not in the API — they're static assets of the member app,
// readable without login.
const APP_URL = process.env.UMS_APP_URL ?? 'http://localhost:3001';
const FLOORS = ['floor1', 'floor2'] as const;

// Which entries the carousel shows, in the order they should appear. Groups
// stay out: they are all function groups (IT, Kiosk) — internal working groups,
// not something to join for the activity. The floor map still names them, since
// they occupy rooms.
const KINDS = ['workshop', 'areaOfInterest'] as const;

// Asset cache. Filenames come from the `v` query parameter the API stamps onto
// every asset URL, so a new version lands under a new name and an unchanged one
// is a plain cache hit — no re-download, no re-encode.
const CACHE_DIR = join(process.cwd(), 'public/ums-data');
const CACHE_URL = '/ums-data';
const MAX_IMAGE_WIDTH = 1200;
// Activity photos are only shown as thumbnails; twice their CSS size is plenty.
const THUMB_WIDTH = 480;

// The API may leave out either language; the site always shows something, so a
// missing one falls back to the other.
const localized = z
  .object({ sv: z.string().optional(), en: z.string().optional() })
  .refine(value => value.sv !== undefined || value.en !== undefined, 'no language')
  .transform(value => ({ sv: (value.sv ?? value.en)!, en: (value.en ?? value.sv)! }));

// A room, as the pair the floor plans are keyed on.
const placeSchema = z.object({ spaceId: z.string(), floor: z.string() });

// The fields an activity and a free-standing event describe themselves with.
// Workshop and group are entry ids, and only ever point at published entries.
const activityFields = {
  category: z.string().optional(),
  workshop: z.string().optional(),
  group: z.string().optional(),
  space: placeSchema.optional(),
  cost: z.number().optional(),
  membersOnly: z.boolean().optional(),
};

// When an event happens. `status` is "confirmed" or "cancelled": a cancelled
// one stays in the response so that whoever planned to come sees it is off.
const eventTimes = {
  start: z.string(),
  end: z.string(),
  status: z.string(),
};

const entrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  // Workshops and areas of interest carry "established" or "trial" in
  // `status`; groups carry "function" in `type`.
  status: z.string().optional(),
  type: z.string().optional(),
  name: localized,
  tag: localized.optional(),
  /* Absolute on a dev instance, relative on the deployed one — see
   * `assetUrl()`, which resolves both. */
  icon: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  text: localized.optional(),
  spaces: z
    .array(
      z.object({
        spaceId: z.string(),
        floor: z.string(),
        role: z.string(),
        color: z.string(),
      })
    )
    .optional(),
  // Activities only (`kind: "activity"`).
  ...activityFields,
  durationMinutes: z.number().optional(),
  /* Its events from now on, soonest first. An event names a `name` or a
   * `space` only where it differs from the activity's. */
  events: z
    .array(z.object({ ...eventTimes, name: localized.optional(), space: placeSchema.optional() }))
    .optional(),
});

// An event that belongs to no activity, such as a cleaning day.
const freeEventSchema = z.object({
  id: z.string(),
  name: localized,
  text: localized.optional(),
  image: z.string().min(1).optional(),
  ...activityFields,
  ...eventTimes,
});

const categorySchema = z.object({ id: z.string(), name: localized });

const spaceSchema = z.object({
  spaceId: z.string(),
  floor: z.string(),
  name: localized,
  text: localized.optional(),
  icon: z.string().min(1).optional(),
  // px in SVG user units — the drawings are 1610×3425 and 725×1110, so these
  // are large numbers on floor 1 and small ones on floor 2.
  iconSize: z.number().optional(),
  workshop: z.string().optional(),
  areasOfInterest: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
});

const responseSchema = z.object({
  entries: z.array(entrySchema),
  spaces: z.array(spaceSchema).default([]),
  palette: z.record(z.string()).default({}),
  events: z.array(freeEventSchema).default([]),
  categories: z.array(categorySchema).default([]),
});

export type EntryKind = (typeof KINDS)[number];

export type Entry = {
  id: string;
  kind: EntryKind;
  status?: string;
  name: Record<Locale, string>;
  tag?: Record<Locale, string>;
  /** Local path to the cached icon (an SVG, drawn in black). Not always present. */
  icon?: string;
  /** Local path to the cached photo. Not every entry has one. */
  image?: string;
  /** Generated: the API carries no alt text. */
  imageAlt: Record<Locale, string>;
  text: Record<Locale, string>;
};

/** One room on a floor plan, with whoever uses it resolved. */
export type Room = {
  spaceId: string;
  name: Record<Locale, string>;
  text?: Record<Locale, string>;
  /** Local path to the cached icon, placed on the room's marker. */
  icon?: string;
  iconSize?: number;
  workshop?: { id: string; name: Record<Locale, string>; status?: string };
  areasOfInterest: { id: string; name: Record<Locale, string>; status?: string }[];
  groups: { id: string; name: Record<Locale, string> }[];
};

export type Floor = {
  key: string;
  /** Local path to the cached floor plan. Same-origin, which `<object>` needs. */
  svg: string;
  rooms: Room[];
};

export type FloorMap = {
  floors: Floor[];
  palette: Record<string, string>;
};

/** One time something happens: an event of an activity, or a free-standing one. */
export type Occasion = {
  /** Unique on the page, usable as a DOM id. */
  id: string;
  /** ISO 8601, UTC. */
  start: string;
  end: string;
  cancelled: boolean;
  name: Record<Locale, string>;
  text?: Record<Locale, string>;
  /** The activity it is an event of; absent for a free-standing one. */
  activity?: { id: string; name: Record<Locale, string> };
  category?: Record<Locale, string>;
  /** The room's name from the floor plans. */
  place?: Record<Locale, string>;
  workshop?: { id: string; name: Record<Locale, string> };
  /** In kronor; absent when free. */
  cost?: number;
  membersOnly: boolean;
};

/** Something the makerspace does again and again, with its occasions to come. */
export type Activity = {
  id: string;
  name: Record<Locale, string>;
  text?: Record<Locale, string>;
  category?: Record<Locale, string>;
  place?: Record<Locale, string>;
  workshop?: { id: string; name: Record<Locale, string> };
  cost?: number;
  membersOnly: boolean;
  durationMinutes?: number;
  /** Local path to the cached thumbnail. Not every activity has one. */
  image?: string;
  /** Generated: the API carries no alt text. */
  imageAlt: Record<Locale, string>;
  /** The first occasion to come that is not cancelled; `id` is its calendar anchor. */
  next?: { id: string; start: string };
  /** How many occasions to come are planned, cancelled ones excluded. */
  planned: number;
};

export type { Locale };

type PublicData = {
  entries: z.infer<typeof entrySchema>[];
  events: z.infer<typeof freeEventSchema>[];
  categories: z.infer<typeof categorySchema>[];
  spaces: z.infer<typeof spaceSchema>[];
  palette: Record<string, string>;
  assets: { entryIcons: Map<string, string>; entryImages: Map<string, string> };
  rooms: Map<string, Room[]>;
  floorSvgs: Map<string, string>;
};

// Memoised: fetching, caching and — crucially — pruning must happen exactly once
// per build. The prune deletes everything in the cache directory the response
// doesn't reference, so two independent loads would delete each other's files.
let pending: Promise<PublicData> | undefined;

function loadPublicData(): Promise<PublicData> {
  pending ??= fetchAndCache();
  return pending;
}

async function fetchAndCache(): Promise<PublicData> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Verkstads-API:t svarade ${response.status} på ${API_URL}`);
  }

  /* A 200 is not enough. An unknown path on the members app answers with the
   * app shell — 200, and HTML — so a wrong URL, or an umsme that has not been
   * deployed with this endpoint yet, would otherwise fail deep inside JSON.parse
   * with nothing pointing at the cause. */
  const body = await response.text();
  const type = response.headers.get('content-type') ?? 'okänd';
  if (!type.includes('json') || body.trimStart().startsWith('<')) {
    throw new Error(
      `Verkstads-API:t på ${API_URL} svarade med ${type} i stället för JSON.\n` +
        `Första tecknen: ${JSON.stringify(body.trimStart().slice(0, 120))}\n` +
        `Ser det ut som en webbsida är URL:en fel, eller så saknar den umsme-instansen ` +
        `endpointen /api/public/entries. Kontrollera UMS_API_URL.`
    );
  }

  const { entries, spaces, palette, events, categories } = responseSchema.parse(JSON.parse(body));

  const entryIcons = new Map<string, string>();
  const entryImages = new Map<string, string>();
  const spaceIcons = new Map<string, string>();

  // Only the entries the carousel shows need their card assets. The floor map
  // uses the space icons and the entries' names, so caching a photo for, say,
  // IT-gruppen would be ~180 kB nothing ever displays.
  await Promise.all([
    ...entries.filter(isPresented).map(async entry => {
      if (entry.icon) entryIcons.set(entry.id, await cacheAsset(entry.icon, 'icon'));
      if (entry.image) entryImages.set(entry.id, await cacheAsset(entry.image, 'image'));
    }),
    ...entries.filter(isActivity).map(async activity => {
      if (activity.image) {
        entryImages.set(activity.id, await cacheAsset(activity.image, 'image', THUMB_WIDTH));
      }
    }),
    ...spaces.map(async space => {
      if (space.icon) {
        spaceIcons.set(spaceKey(space.spaceId, space.floor), await cacheAsset(space.icon, 'icon'));
      }
    }),
  ]);

  // The floor plans have no version stamp, so they're fetched fresh every build
  // and overwritten. They're 9.6 kB and 8.3 kB.
  const floorSvgs = new Map<string, string>();
  for (const floor of FLOORS) {
    floorSvgs.set(floor, await cacheFloorPlan(floor));
  }

  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const named = (id: string) => {
    const entry = byId.get(id);
    return entry ? { id, name: entry.name, status: entry.status } : undefined;
  };

  const rooms = new Map<string, Room[]>();
  for (const floor of FLOORS) {
    rooms.set(
      floor,
      spaces
        .filter(space => space.floor === floor)
        .map(space => ({
          spaceId: space.spaceId,
          name: space.name,
          text: space.text,
          icon: spaceIcons.get(spaceKey(space.spaceId, space.floor)),
          iconSize: space.iconSize,
          workshop: space.workshop ? named(space.workshop) : undefined,
          areasOfInterest: (space.areasOfInterest ?? [])
            .map(named)
            .filter(Boolean) as Room['areasOfInterest'],
          groups: (space.groups ?? []).map(named).filter(Boolean) as Room['groups'],
        }))
    );
  }

  await pruneCache([
    ...entryIcons.values(),
    ...entryImages.values(),
    ...spaceIcons.values(),
    ...floorSvgs.values(),
  ]);

  return {
    entries,
    events,
    categories,
    spaces,
    palette,
    assets: { entryIcons, entryImages },
    rooms,
    floorSvgs,
  };
}

const spaceKey = (spaceId: string, floor: string) => `${floor}/${spaceId}`;

// What the carousel shows.
const isPresented = (entry: z.infer<typeof entrySchema>): entry is typeof entry & { kind: EntryKind } =>
  (KINDS as readonly string[]).includes(entry.kind);

const altFor = (name: Record<Locale, string>) => ({
  sv: `Illustrativ bild för ${name.sv}`,
  en: `Illustrative image for ${name.en}`,
});

/** Workshops first, then areas of interest, each in the order the API returned them. */
export async function getEntries(): Promise<Entry[]> {
  const data = await loadPublicData();

  return data.entries
    .filter(isPresented)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
    .map(entry => ({
      id: entry.id,
      kind: entry.kind,
      status: entry.status,
      name: entry.name,
      tag: entry.tag,
      icon: data.assets.entryIcons.get(entry.id),
      image: data.assets.entryImages.get(entry.id),
      imageAlt: altFor(entry.name),
      text: entry.text ?? { sv: '', en: '' },
    }));
}

/** The two floor plans with every room, ready for the client to draw. */
export async function getFloorMap(): Promise<FloorMap> {
  const data = await loadPublicData();
  return {
    palette: data.palette,
    floors: FLOORS.map(floor => ({
      key: floor,
      svg: data.floorSvgs.get(floor)!,
      rooms: data.rooms.get(floor) ?? [],
    })),
  };
}

// An activity has at most one event starting at a given minute, so this is
// unique, and stable for as long as the activity keeps its name.
const occasionId = (activityId: string, start: string) =>
  `${activityId}-${start.slice(0, 16).replace(/\D/g, '')}`;

function describer(data: PublicData) {
  const entryById = new Map(data.entries.map(entry => [entry.id, entry]));
  const categoryById = new Map(data.categories.map(category => [category.id, category.name]));
  const spaceByKey = new Map(data.spaces.map(space => [spaceKey(space.spaceId, space.floor), space.name]));

  type Described = z.infer<typeof freeEventSchema> | z.infer<typeof entrySchema>;
  const describe = (source: Described, space: z.infer<typeof placeSchema> | undefined) => {
    const workshop = source.workshop ? entryById.get(source.workshop) : undefined;
    return {
      text: source.text,
      category: source.category ? categoryById.get(source.category) : undefined,
      place: space ? spaceByKey.get(spaceKey(space.spaceId, space.floor)) : undefined,
      workshop: workshop ? { id: workshop.id, name: workshop.name } : undefined,
      cost: source.cost,
      membersOnly: source.membersOnly ?? false,
    };
  };
  return describe;
}

const isActivity = (entry: z.infer<typeof entrySchema>) => entry.kind === 'activity';

/** Every occasion to come, of activities and free-standing, soonest first. */
export async function getOccasions(): Promise<Occasion[]> {
  const data = await loadPublicData();
  const describe = describer(data);

  const ofActivities = data.entries
    .filter(isActivity)
    .flatMap(activity =>
      (activity.events ?? []).map(event => ({
        id: occasionId(activity.id, event.start),
        start: event.start,
        end: event.end,
        cancelled: event.status === 'cancelled',
        name: event.name ?? activity.name,
        activity: { id: activity.id, name: activity.name },
        ...describe(activity, event.space ?? activity.space),
      }))
    );

  const freeStanding = data.events.map(event => ({
    id: event.id,
    start: event.start,
    end: event.end,
    cancelled: event.status === 'cancelled',
    name: event.name,
    ...describe(event, event.space),
  }));

  return [...ofActivities, ...freeStanding].sort((a, b) => a.start.localeCompare(b.start));
}

/** Every published activity, in the order the API returned them. */
export async function getActivities(): Promise<Activity[]> {
  const data = await loadPublicData();
  const describe = describer(data);

  return data.entries.filter(isActivity).map(activity => {
    const planned = (activity.events ?? []).filter(event => event.status !== 'cancelled');
    const next = planned[0];
    return {
      id: activity.id,
      name: activity.name,
      image: data.assets.entryImages.get(activity.id),
      imageAlt: altFor(activity.name),
      ...describe(activity, activity.space),
      durationMinutes: activity.durationMinutes,
      next: next ? { id: occasionId(activity.id, next.start), start: next.start } : undefined,
      planned: planned.length,
    };
  });
}

/* The API hands out asset references relative to itself on a deployed instance
 * (`/api/spaces/…`) and absolute on a dev one (`http://localhost:3000/api/…`).
 * Resolving against the endpoint covers both, and keeps the `?v=` stamp that the
 * cache is keyed on. */
const assetUrl = (raw: string) => new URL(raw, API_URL);

async function cacheAsset(
  raw: string,
  kind: 'icon' | 'image',
  width = MAX_IMAGE_WIDTH
): Promise<string> {
  const url = assetUrl(raw);
  const base = cacheFileName(url, kind === 'icon' ? '.svg' : '.jpg');
  // A smaller size is a different file, even of the same version.
  const name = width === MAX_IMAGE_WIDTH ? base : base.replace(/(\.\w+)$/, `-w${width}$1`);
  const target = join(CACHE_DIR, name);
  if (await exists(target)) return `${CACHE_URL}/${name}`;

  const bytes = await download(url.href, kind);
  await mkdir(CACHE_DIR, { recursive: true });

  // The API serves full-resolution photos (~2 MB); downscale for the web.
  // Encoded in memory and written in one go, so a failed encode can't leave a
  // half-written file behind that the next build would take for a cache hit.
  await writeFile(
    target,
    kind === 'image'
      ? await sharp(bytes)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer()
      : bytes
  );

  return `${CACHE_URL}/${name}`;
}

// No `?v=` stamp on these, so there's nothing to compare — always re-fetch and
// overwrite. They must be same-origin with the page: `<object>` only exposes
// `contentDocument` (which is how the rooms get coloured and clicked) when it is.
async function cacheFloorPlan(floor: string): Promise<string> {
  const name = `${floor}.svg`;
  const bytes = await download(`${APP_URL}/images/${name}`, 'floor plan');
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, name), bytes);
  return `${CACHE_URL}/${name}`;
}

async function download(url: string, what: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Kunde inte hämta ${what} (${response.status}): ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// The version stamp is the natural cache key: `?v=2026/workshop-<id>-<ms>.jpg`.
// Anything unexpected falls back to a name derived from the path, so remote data
// can never write outside the cache directory.
//
// The static server picks the content type from the file's extension, and
// activity images come with a stamp that has none, so one is added. A stamp
// that has one keeps it — even `.png` on what is now a JPEG, which browsers
// sniff fine — because renaming would turn every cached file into a miss.
function cacheFileName(url: URL, extension: string): string {
  const stamp = url.searchParams.get('v')?.split('/').pop();
  if (stamp && /^[\w.-]+$/.test(stamp)) {
    return /\.\w+$/.test(stamp) ? stamp : `${stamp}${extension}`;
  }
  return `${url.pathname.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')}${extension}`;
}

// The cache directory belongs to this module, so anything the current response
// doesn't reference is a leftover — an older asset version, or an entry we no
// longer present — and shouldn't be shipped in the build.
async function pruneCache(used: (string | undefined)[]): Promise<void> {
  const keep = new Set(used.filter(Boolean).map(path => path!.slice(CACHE_URL.length + 1)));
  let cached: string[];
  try {
    cached = await readdir(CACHE_DIR);
  } catch {
    return;
  }
  await Promise.all(
    cached
      .filter(name => !keep.has(name))
      .map(name => rm(join(CACHE_DIR, name), { force: true }))
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
