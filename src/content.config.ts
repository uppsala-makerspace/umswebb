import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const localeEnum = z.enum(['sv', 'en']);

const pageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  lang: localeEnum,
  // Links the sv and en versions of an entry, and is a post's URL (see
  // `postSlug()`). The CMS writes it first in the front matter as its
  // "canonical slug", so the existing files keep it there too. Optional only so
  // a hand-written file can leave it out.
  translationKey: z.string().optional(),
  // Optional URL slug override. When set, this becomes the URL segment for the
  // page (e.g. `slug: our-space` → `/en/our-space/`). When unset, the filename
  // stem is used. Lets us keep stable filenames in git while translating URLs.
  slug: z.string().optional(),
  updatedDate: z.coerce.date().optional(),
  draft: z.boolean().default(false),
});

const postSchema = pageSchema.extend({
  date: z.coerce.date(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const pages = defineCollection({
  // Exclude `_deprecated/` so retired-but-kept-for-history files stay in
  // git but don't enter the collection or generate routes.
  loader: glob({ pattern: ['**/*.md', '!**/_deprecated/**'], base: './src/content/pages' }),
  schema: pageSchema,
});

const posts = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_deprecated/**'], base: './src/content/posts' }),
  schema: postSchema,
});

export const collections = { pages, posts };
