import type { CollectionEntry } from 'astro:content';

// URL slug for a page entry — `data.slug` if explicitly set, otherwise the
// filename stem (the part of the entry id after the locale prefix).
export function pageSlug(entry: CollectionEntry<'pages'>): string {
  return entry.data.slug ?? entry.id.replace(/^(?:sv|en)\//, '');
}

// URL slug for a post entry — `data.slug` if set, otherwise `translationKey`
// (which is the filename stem without the date prefix).
export function postSlug(entry: CollectionEntry<'posts'>): string {
  return entry.data.slug ?? entry.data.translationKey;
}
