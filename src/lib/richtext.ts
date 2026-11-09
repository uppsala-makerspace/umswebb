// The workshop API delivers texts as Markdown. What actually occurs in the data
// is blank-line paragraphs, `**bold**` and bare URLs (sign-up links in event
// descriptions), so that's what we render; everything else is escaped and shown
// literally rather than silently dropped.
export function toParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(inline);
}

// An http(s) URL up to whitespace, not ending in punctuation that more likely
// belongs to the sentence: "anmäl dig på https://…/239656." or "(se https://…)".
// Captured, so `split` keeps the URLs as the odd-numbered parts.
const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'])/;

// URLs are split out before escaping: in escaped text `&` is already `&amp;`
// and a `<` right after a URL would read as part of it.
function inline(block: string): string {
  return block
    .split(URL_PATTERN)
    .map((part, i) => (i % 2 ? link(part) : bold(escapeHtml(part))))
    .join('')
    .replace(/\n/g, '<br />');
}

function link(url: string): string {
  const safe = escapeHtml(url);
  return `<a href="${safe}" rel="noopener">${safe}</a>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
