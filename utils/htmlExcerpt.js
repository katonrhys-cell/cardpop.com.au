// Build a plain-text excerpt from an HTML string.
//
// Blog `content` is stored as HTML, so naively slicing it (content.substring(0, n))
// cuts through the middle of a tag and renders broken markup. This strips tags,
// decodes the common named entities, collapses whitespace, and truncates on a
// word boundary with an ellipsis.
export function htmlExcerpt(html, maxLen = 130) {
  if (!html) return '';
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '').trimEnd() + '…';
}

export default htmlExcerpt;
