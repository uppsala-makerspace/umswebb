// The workshop API delivers texts as Markdown. What actually occurs in the data
// is blank-line paragraphs and `**bold**`, so that's what we render; everything
// else is escaped and shown literally rather than silently dropped.
export function toParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => bold(escapeHtml(block)).replace(/\n/g, '<br />'));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
