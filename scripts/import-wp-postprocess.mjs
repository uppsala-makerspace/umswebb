#!/usr/bin/env node
// Post-process wordpress-export-to-markdown output:
// - strip qTranslate-X markers from titles and bodies
// - normalise frontmatter to our content collection schema
// - rewrite image paths from `images/...` to `/uploads/wp/...`
// - move pages to src/content/pages/sv (slug.md), drafts to _drafts/
// - move posts to src/content/posts/sv (YYYY-MM-DD-slug.md), drafts to _drafts/
// - copy all imported images into public/uploads/wp/
//
// Re-runnable. Reads from `_wp-import/`.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const IMPORT = join(ROOT, '_wp-import');
const OUT = {
  pages: join(ROOT, 'src/content/pages/sv'),
  pagesDrafts: join(ROOT, 'src/content/pages/sv/_drafts'),
  posts: join(ROOT, 'src/content/posts/sv'),
  postsDrafts: join(ROOT, 'src/content/posts/sv/_drafts'),
  uploads: join(ROOT, 'public/uploads/wp'),
};

for (const dir of Object.values(OUT)) mkdirSync(dir, { recursive: true });

function stripQTranslate(text) {
  if (!text) return text;
  return text
    .replace(/<!--:[a-z]*-->/g, '')
    .replace(/\\?\[:[a-z]+\\?\]/g, '')
    .replace(/\\?\[:\\?\]/g, '')
    .trim();
}

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!km) continue;
    let val = km[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    fm[km[1]] = val;
  }
  return { fm, body: m[2] };
}

function yamlString(str) {
  return JSON.stringify(String(str));
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (v instanceof Date) lines.push(`${k}: ${v.toISOString().slice(0, 10)}`);
    else if (Array.isArray(v)) lines.push(`${k}: [${v.map(yamlString).join(', ')}]`);
    else lines.push(`${k}: ${yamlString(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function rewriteImagePaths(body) {
  return body.replace(/(\]\(|src=["'])images\/([^)\s"']+)/g, '$1/uploads/wp/$2');
}

// Rewrite absolute URLs that point at the old WordPress site:
//   https://www.uppsalamakerspace.se/bli-medlem/      → /bli-medlem/
//   https://www.uppsalamakerspace.se/2022/01/15/foo/ → /nyheter/foo/
//   https://www.uppsalamakerspace.se/wp-content/uploads/.../bar.jpg → /uploads/wp/bar.jpg
//                                                      (only if the file was imported)
// Rewrite inbound links to renamed post slugs:
//   /nyheter/<old-slug>/ → /nyheter/<new-slug>/
function rewritePostSlugs(body, renames) {
  return body.replace(
    /\/nyheter\/([a-zA-Z0-9_-]+)(\/?)/g,
    (match, oldSlug, trailing) => {
      const newSlug = renames[oldSlug];
      return newSlug ? `/nyheter/${newSlug}${trailing}` : match;
    },
  );
}

// Inbound-link fixups for deleted pages. REDIRECT_LINKS rewrite the href to
// a sensible alternative. UNLINK_DELETED_SLUGS strips the markdown link
// wrapping for stale-event references, keeping the visible text.
// Order matters: longer / more specific patterns first, so they don't get
// partially rewritten by shorter ones. (Bug fix: previously the inner
// `/keramikverkstad/` was replaced first, leaving a broken
// `/aktiviteter/nyheter/succe-for-keramiken/` path.)
const REDIRECT_LINKS = {
  '/aktiviteter/keramikverkstad/': '/nyheter/succe-for-keramiken/',
  '/keramikverkstad/':             '/nyheter/succe-for-keramiken/',
  // The old in-iframe membership lookup is now handled inside the app.
  '/medlem/':                      'https://app.uppsalamakerspace.se/',
};
const UNLINK_DELETED_SLUGS = [
  'test', 'test123', 'testkalendern-exe',
  'pysselfika', 'pepparkaksbybygge', 'vi-skapar-en-3d-skrivare-fran-grunden',
  'aktiviteter', 'medlemsprojekt', 'kontakta',
  'kop-av-var-lokal', 'lokalinsamling', 'verktyg',
];

// Rewrite any embed URL pointing at our Google Calendar (matched by
// calendar ID, regardless of params) to the local /kalender/ page.
function rewriteCalendarUrls(body) {
  return body.replace(
    /https:\/\/calendar\.google\.com\/[^\s)"'<>]*bt89ob2d1fhelenvd80up783lc[^\s)"'<>]*/g,
    '/kalender/',
  );
}

function applyDeletedPageFixups(body) {
  for (const [from, to] of Object.entries(REDIRECT_LINKS)) {
    body = body.replaceAll(from, to);
  }
  const unlinkRe = new RegExp(
    `\\[([^\\]]+)\\]\\(/(?:${UNLINK_DELETED_SLUGS.join('|')})/\\)`,
    'g',
  );
  body = body.replace(unlinkRe, '$1');
  return body;
}

function rewriteOldDomainLinks(body, uploadFiles) {
  const re = /https?:\/\/(?:www\.)?uppsalamakerspace\.se([^\s)\]"'<>“”‘’]*)/g;
  return body.replace(re, (match, rawPath) => {
    let path = rawPath;
    let trailing = '';
    while (path.length && /[.,;:!?]/.test(path[path.length - 1])) {
      trailing = path[path.length - 1] + trailing;
      path = path.slice(0, -1);
    }

    if (!path || path === '/') return '/' + trailing;

    const uploadMatch = path.match(/^\/wp-content\/uploads\/[^?#]*\/([^/?#]+)$/);
    if (uploadMatch) {
      const filename = decodeURIComponent(uploadMatch[1]);
      if (uploadFiles.has(filename)) {
        return `/uploads/wp/${filename}` + trailing;
      }
      return match; // asset wasn't imported (e.g. PDF) — keep original URL
    }

    const datedMatch = path.match(/^\/\d{4}\/\d{2}\/\d{2}\/([^/?#]+)\/?$/);
    if (datedMatch) {
      return `/nyheter/${datedMatch[1]}/` + trailing;
    }

    return path + trailing;
  });
}

// Page slugs that should not be imported. Rationale per slug:
//   nyheter                     — handled by /nyheter/ route
//   test, test123, testkalendern-exe
//                               — junk test pages
//   keramikverkstad             — fundraiser explicitly marked closed
//   pysselfika, pepparkaksbybygge, vi-skapar-en-3d-skrivare-fran-grunden
//                               — stale event announcements stored as pages
//   id-117, id-124, id-910, id-2273, verksamhet
//                               — abandoned draft stubs
const SKIP_PAGE_SLUGS = new Set([
  'nyheter',
  // Hand-curated replacement lives at src/content/pages/sv/bli-medlem.md;
  // the WXR version is preserved under _deprecated/ for reference.
  'bli-medlem',
  // Replaced by /kalender/ (Google Calendar feed). Original under _deprecated/.
  'aktiviteter',
  // Deprecated; original under _deprecated/.
  'medlemsprojekt',
  // Deprecated; contact info merged into /om/. Original under _deprecated/.
  'kontakta',
  // The home page (`/`) is rendered directly by src/pages/index.astro now;
  // start.md is preserved under _deprecated/.
  'start',
  // Historic fundraiser pages (the campaign closed when the association
  // bought its space). Originals under _deprecated/.
  'kop-av-var-lokal', 'lokalinsamling',
  // Replaced by the new app — membership status and tool listings are now
  // inside the app at app.uppsalamakerspace.se. Originals under _deprecated/.
  'medlem', 'verktyg',
  'test', 'test123', 'testkalendern-exe',
  'keramikverkstad',
  'pysselfika', 'pepparkaksbybygge', 'vi-skapar-en-3d-skrivare-fran-grunden',
  'id-117', 'id-124', 'id-910', 'id-2273', 'verksamhet',
]);

// Pages that should be force-marked as drafts (kept in the repo but not
// rendered). Useful for unfinished material we don't want lost.
const FORCE_DRAFT_PAGE_SLUGS = new Set([
  'ungdomsverksamhet',
]);

// Post slug renames. The original WP slug is unsuitable (autogenerated WP
// post ID, or someone pasted a REST API URL into the slug). The override is
// applied to the output filename, the translationKey, and to inbound
// /nyheter/<old>/ links in other markdown bodies.
const POST_SLUG_OVERRIDES = {
  '441':                       '3d-modelleringskurs-i-blender-2016',
  'wp-json-wp-v2-posts-1234':  'introduktion-till-punktsvetsen-batterisvetsen-12-mars',
  'wp-json-wp-v2-posts-1238':  'introduktion-till-verkstaden-trarummet',
  'wp-json-wp-v2-posts-1656':  'oppet-hus-internationella-reparationsdagen-2021',
  'wp-json-wp-v2-posts-1769':  'goda-nyheter-om-foreningens-ekonomi',
  'wp-json-wp-v2-posts-1803':  'nytt-fran-styrelsen-januari-2022',
  'wp-json-wp-v2-posts-2070':  '3d-modelleringskurs-i-blender-2022',
  'wp-json-wp-v2-posts-2084':  'vi-njuter-av-nasas-asteroidkollision',
};

function processFile(srcPath, kind, isDraft) {
  const filename = basename(srcPath);
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  let dateStr;
  let slug;
  if (dateMatch) {
    [, dateStr, slug] = dateMatch;
  } else {
    // Drafts lacking a publish date are named id-<wpid>.md by the importer.
    // Keep them, mark draft, and use today as a placeholder date.
    const stem = filename.replace(/\.md$/, '');
    slug = stem;
    dateStr = new Date().toISOString().slice(0, 10);
    isDraft = true;
  }

  if (kind === 'pages' && SKIP_PAGE_SLUGS.has(slug)) return false;
  if (kind === 'pages' && FORCE_DRAFT_PAGE_SLUGS.has(slug)) isDraft = true;
  if (kind === 'posts' && POST_SLUG_OVERRIDES[slug]) slug = POST_SLUG_OVERRIDES[slug];

  const raw = readFileSync(srcPath, 'utf8');
  const { fm, body } = parseFrontmatter(raw);

  const title = stripQTranslate(fm.title) || slug;
  const cleanedBody = rewriteCalendarUrls(
    applyDeletedPageFixups(
      rewritePostSlugs(
        rewriteOldDomainLinks(
          rewriteImagePaths(stripQTranslate(body)),
          uploadFiles,
        ),
        POST_SLUG_OVERRIDES,
      ),
    ),
  );

  const newFm = {
    title,
    lang: 'sv',
    translationKey: slug,
  };

  if (kind === 'posts') {
    newFm.date = fm.date || dateStr;
  }
  if (isDraft) newFm.draft = true;
  if (fm.coverImage) {
    newFm.cover = fm.coverImage.replace(/^images\//, '/uploads/wp/');
  }

  const outDirKey = kind === 'pages'
    ? (isDraft ? 'pagesDrafts' : 'pages')
    : (isDraft ? 'postsDrafts' : 'posts');
  const outName = kind === 'pages' ? `${slug}.md` : `${dateStr}-${slug}.md`;
  const outPath = join(OUT[outDirKey], outName);
  writeFileSync(outPath, buildFrontmatter(newFm) + '\n\n' + cleanedBody.replace(/^\s+/, '') + '\n');
  return true;
}

function copyImagesFrom(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const file of readdirSync(dir)) {
    const src = join(dir, file);
    if (!file.match(/\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)$/i)) continue;
    copyFileSync(src, join(OUT.uploads, file));
    n++;
  }
  return n;
}

function processDir(subdir, kind, isDraft) {
  const path = join(IMPORT, subdir);
  if (!existsSync(path)) return 0;
  let n = 0;
  for (const f of readdirSync(path)) {
    if (!f.endsWith('.md')) continue;
    if (processFile(join(path, f), kind, isDraft)) n++;
  }
  return n;
}

// Copy images first so processFile can check which old-domain wp-content URLs
// point to assets we now have locally.
const imageCount =
  copyImagesFrom(join(IMPORT, 'pages/images')) +
  copyImagesFrom(join(IMPORT, 'posts/images')) +
  copyImagesFrom(join(IMPORT, 'pages/_drafts/images')) +
  copyImagesFrom(join(IMPORT, 'posts/_drafts/images'));

const uploadFiles = new Set(readdirSync(OUT.uploads));

const pageCount = processDir('pages', 'pages', false);
const pageDraftCount = processDir('pages/_drafts', 'pages', true);
const postCount = processDir('posts', 'posts', false);
const postDraftCount = processDir('posts/_drafts', 'posts', true);

console.log(`pages:  ${pageCount} published, ${pageDraftCount} drafts`);
console.log(`posts:  ${postCount} published, ${postDraftCount} drafts`);
console.log(`images: ${imageCount} copied to public/uploads/wp/`);
