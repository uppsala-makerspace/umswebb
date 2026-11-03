/* Editor components for the placeholders the site's Markdown embeds. Each one
 * reads back exactly what toBlock() writes, and toBlock() writes exactly what
 * the content files already contain, so opening and saving a page without
 * changes leaves the file as it was.
 *
 * What renders them on the site:
 *   floorMap   src/components/FloorMapEmbed.astro
 *   board      src/components/BoardList.astro
 *   gallery    src/components/MarkdownGallery.astro (+ .gallery in global.css)
 *   googleMap  a plain iframe */

const placeholder = text =>
  `<div style="padding:1.5em;border:2px dashed #9ca3af;border-radius:8px;text-align:center;color:#4b5563">${text}</div>`;

const escapeAttr = value => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

CMS.registerEditorComponent({
  id: 'floorMap',
  label: 'Karta över lokalen',
  fields: [],
  pattern: /^<div data-floor-map><\/div>$/m,
  fromBlock: () => ({}),
  toBlock: () => '<div data-floor-map></div>',
  toPreview: () => placeholder('Karta över lokalen (ritas från medlemsappens data)'),
});

CMS.registerEditorComponent({
  id: 'board',
  label: 'Styrelsen genom åren',
  fields: [],
  pattern: /^<div data-board><\/div>$/m,
  fromBlock: () => ({}),
  toBlock: () => '<div data-board></div>',
  toPreview: () => placeholder('Styrelsen genom åren'),
});

// A gallery is a <div data-gallery> around linked images, one per paragraph:
//   [![alt](src)](src)
// The link makes each image open full size.
const GALLERY_IMAGE = /^\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)$/;

CMS.registerEditorComponent({
  id: 'gallery',
  label: 'Bildgalleri',
  fields: [
    {
      name: 'label',
      label: 'Beskrivning för skärmläsare',
      widget: 'string',
      required: false,
    },
    {
      name: 'images',
      label: 'Bilder',
      widget: 'list',
      fields: [
        { name: 'image', label: 'Bild', widget: 'image' },
        { name: 'alt', label: 'Alternativtext', widget: 'string' },
      ],
    },
  ],
  pattern: /^<div class="gallery" data-gallery(?: aria-label="([^"]*)")?>\n([\s\S]*?)\n<\/div>$/m,
  fromBlock: match => ({
    label: match[1] ?? '',
    images: match[2]
      .split('\n')
      .map(line => line.trim().match(GALLERY_IMAGE))
      .filter(Boolean)
      .map(([, alt, image]) => ({ image, alt })),
  }),
  toBlock: ({ label, images } = {}) => {
    const open = label
      ? `<div class="gallery" data-gallery aria-label="${escapeAttr(label)}">`
      : '<div class="gallery" data-gallery>';
    const items = (images ?? [])
      .filter(item => item?.image)
      .map(({ image, alt }) => `[![${alt ?? ''}](${image})](${image})`);
    return [open, ...items, '</div>'].join('\n\n');
  },
  toPreview: ({ images } = {}) =>
    `<div style="display:flex;gap:8px;overflow-x:auto">${(images ?? [])
      .filter(item => item?.image)
      .map(({ image, alt }) => `<img src="${escapeAttr(image)}" alt="${escapeAttr(alt)}" style="height:120px">`)
      .join('')}</div>`,
});

// Only the address is edited. The other attributes vary between the embeds
// Google has handed out over the years, so they're carried along as they are.
const MAP_ATTRIBUTES =
  ' width="600" height="450" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"';

CMS.registerEditorComponent({
  id: 'googleMap',
  label: 'Google-karta',
  fields: [
    {
      name: 'src',
      label: 'Adress',
      hint: 'I Google Maps: Dela → Bädda in en karta, och kopiera adressen inom src="…".',
      widget: 'string',
      pattern: ['^https://www\\.google\\.com/maps/embed', 'Ska börja med https://www.google.com/maps/embed'],
    },
    { name: 'attributes', widget: 'hidden', required: false },
  ],
  pattern: /^<iframe src="(https:\/\/www\.google\.com\/maps\/embed[^"]*)"([^>]*)><\/iframe>$/m,
  fromBlock: match => ({ src: match[1], attributes: match[2] }),
  toBlock: ({ src, attributes } = {}) =>
    `<iframe src="${escapeAttr(src)}"${attributes || MAP_ATTRIBUTES}></iframe>`,
  toPreview: ({ src } = {}) =>
    src
      ? `<iframe src="${escapeAttr(src)}" width="100%" height="300" style="border:0"></iframe>`
      : placeholder('Google-karta'),
});
