import { access, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'astro:content';
import type { Locale } from '../data/nav';

// Everything the site needs from the members service comes from one call, at
// build time: the workshops and groups we present, plus every room on the two
// floor plans. Their icons, photos and the floor plans themselves are copied
// into `public/ums-data/` so the built site serves its own assets and never
// points at the API host.
//
// See `umsme/PUBLIC_API_FOR_WEBSITE.md` for the contract. Two things from it
// that shape the code below: keys are absent rather than null, and `spaceId` is
// only unique per floor — `kitchen`, `entrance` and `boxstorage` exist on both,
// so the key is always the pair (spaceId, floor).
const API_URL = process.env.UMS_API_URL ?? 'http://localhost:3000/api/public/entries';

// The floor plans are not in the API — they're static assets of the member app,
// readable without login.
const APP_URL = process.env.UMS_APP_URL ?? 'http://localhost:3001';
const FLOORS = ['floor1', 'floor2'] as const;

// Which entries the carousel shows, in the order they should appear. Of the
// groups only the interest ones belong there — `type: "function"` groups (IT,
// Trivsel) are internal working groups, not something to join for the activity.
// The floor map still names them, since they occupy rooms.
const KINDS = ['workshop', 'group'] as const;
const GROUP_TYPE = 'interest';

// Asset cache. Filenames come from the `v` query parameter the API stamps onto
// every asset URL, so a new version lands under a new name and an unchanged one
// is a plain cache hit — no re-download, no re-encode.
const CACHE_DIR = join(process.cwd(), 'public/ums-data');
const CACHE_URL = '/ums-data';
const MAX_IMAGE_WIDTH = 1200;

const execFileAsync = promisify(execFile);

const localized = z.object({ sv: z.string(), en: z.string() });

const entrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  // Workshops carry "established" or "trial" in `status`; groups carry
  // "interest" or "function" in `type`.
  status: z.string().optional(),
  type: z.string().optional(),
  name: localized,
  tag: localized.optional(),
  /* Absolute on a dev instance, relative on the deployed one — see
   * `assetUrl()`, which resolves both. */
  icon: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  text: localized,
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
});

const spaceSchema = z.object({
  spaceId: z.string(),
  floor: z.string(),
  name: localized,
  text: localized.partial().optional(),
  icon: z.string().min(1).optional(),
  // px in SVG user units — the drawings are 1610×3425 and 725×1110, so these
  // are large numbers on floor 1 and small ones on floor 2.
  iconSize: z.number().optional(),
  workshop: z.string().optional(),
  groups: z.array(z.string()).optional(),
});

const responseSchema = z.object({
  entries: z.array(entrySchema),
  spaces: z.array(spaceSchema).default([]),
  palette: z.record(z.string()).default({}),
});

export type EntryKind = (typeof KINDS)[number];

export type Entry = {
  id: string;
  kind: EntryKind;
  status?: string;
  type?: string;
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
  text?: Partial<Record<Locale, string>>;
  /** Local path to the cached icon, placed on the room's marker. */
  icon?: string;
  iconSize?: number;
  workshop?: { id: string; name: Record<Locale, string>; status?: string };
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

export type { Locale };

type PublicData = {
  entries: z.infer<typeof entrySchema>[];
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

  const { entries, spaces, palette } = responseSchema.parse(JSON.parse(body));

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
  entry.kind === 'workshop' || (entry.kind === 'group' && entry.type === GROUP_TYPE);

/** Workshops first, then interest groups, each in the order the API returned them. */
export async function getEntries(): Promise<Entry[]> {
  const data = await loadPublicData();

  return data.entries
    .filter(isPresented)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
    .map(entry => ({
      id: entry.id,
      kind: entry.kind,
      status: entry.status,
      type: entry.type,
      name: entry.name,
      tag: entry.tag,
      icon: data.assets.entryIcons.get(entry.id),
      image: data.assets.entryImages.get(entry.id),
      imageAlt: {
        sv: `Illustrativ bild för ${entry.name.sv}`,
        en: `Illustrative image for ${entry.name.en}`,
      },
      text: entry.text,
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

/* The API hands out asset references relative to itself on a deployed instance
 * (`/api/spaces/…`) and absolute on a dev one (`http://localhost:3000/api/…`).
 * Resolving against the endpoint covers both, and keeps the `?v=` stamp that the
 * cache is keyed on. */
const assetUrl = (raw: string) => new URL(raw, API_URL);

async function cacheAsset(raw: string, kind: 'icon' | 'image'): Promise<string> {
  const url = assetUrl(raw);
  const name = cacheFileName(url, kind === 'icon' ? '.svg' : '.jpg');
  const target = join(CACHE_DIR, name);
  if (await exists(target)) return `${CACHE_URL}/${name}`;

  const bytes = await download(url.href, kind);
  await mkdir(CACHE_DIR, { recursive: true });

  if (kind === 'image') {
    // The API serves full-resolution photos (~2 MB); downscale for the web.
    // Without ImageMagick on the machine we keep the original rather than fail.
    const original = `${target}.original`;
    await writeFile(original, bytes);
    try {
      await execFileAsync('magick', [
        original,
        '-resize',
        `${MAX_IMAGE_WIDTH}x>`,
        '-quality',
        '82',
        target,
      ]);
      await rm(original);
    } catch {
      await rename(original, target);
    }
  } else {
    await writeFile(target, bytes);
  }

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
function cacheFileName(url: URL, extension: string): string {
  const stamp = url.searchParams.get('v')?.split('/').pop();
  if (stamp && /^[\w.-]+$/.test(stamp)) return stamp;
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
