#!/usr/bin/env node
// Walk imported markdown for absolute URLs to wp-content PDF assets that
// weren't downloaded by the original import (wordpress-export-to-markdown
// only fetches images). Download each PDF into public/uploads/wp/ so the
// next pass of import-wp-postprocess.mjs rewrites the URLs to local paths.
//
// Idempotent: skips files already present locally.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'src/content');
const OUT_DIR = join(ROOT, 'public/uploads/wp');
const REQUEST_DELAY_MS = 200;

mkdirSync(OUT_DIR, { recursive: true });

function walkMd(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkMd(p, acc);
    else if (entry.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const URL_RE = /https?:\/\/(?:www\.)?uppsalamakerspace\.se\/wp-content\/uploads\/[^\s)\]"'<>“”‘’]+?\.pdf/gi;

const urls = new Set();
for (const file of walkMd(CONTENT_DIR)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(URL_RE)) {
    urls.add(match[0]);
  }
}

console.log(`Found ${urls.size} unique PDF URLs`);

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const url of urls) {
  const filename = decodeURIComponent(basename(url));
  const outPath = join(OUT_DIR, filename);

  if (existsSync(outPath)) {
    skipped++;
    continue;
  }

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.warn(`✗ ${res.status} ${url}`);
      failed++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buf);
    console.log(`✓ ${filename}  (${buf.length} bytes)`);
    downloaded++;
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  } catch (err) {
    console.warn(`✗ ${url}: ${err.message}`);
    failed++;
  }
}

console.log(`\n${downloaded} downloaded, ${skipped} already present, ${failed} failed`);
