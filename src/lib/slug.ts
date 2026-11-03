import type { CollectionEntry } from 'astro:content';

// URL slug for a page entry — `data.slug` if explicitly set, otherwise the
// filename stem (the part of the entry id after the locale prefix).
export function pageSlug(entry: CollectionEntry<'pages'>): string {
  return entry.data.slug ?? entry.id.replace(/^(?:sv|en)\//, '');
}

// URL slug for a post entry — `data.slug` if set, otherwise `translationKey`,
// otherwise the filename stem without the locale and date prefixes. The last
// two agree for every post the CMS or the WordPress import wrote.
export function postSlug(entry: CollectionEntry<'posts'>): string {
  return (
    entry.data.slug ??
    entry.data.translationKey ??
    entry.id.replace(/^(?:sv|en)\//, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
  );
}
