// What the admin visual editor (components/admin/RichTextEditor.jsx, Tiptap
// StarterKit + Image) can hold. Anything else — a table from the nightly blog
// generator, an embed or layout wrapper from an imported HTML file — is dropped
// the moment the article is edited visually, so the article editor opens such
// content in the HTML view instead and says why.

const VISUAL_EDITOR_TAGS = new Set([
  'p', 'br', 'hr', 'h2', 'h3', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img',
]);

// Tag names in `html` the visual editor would lose, in first-seen order.
export const unsupportedVisualTags = (html) => {
  const found = [];
  const seen = new Set();
  const re = /<\s*([a-zA-Z][a-zA-Z0-9-]*)/g;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const tag = match[1].toLowerCase();
    if (!VISUAL_EDITOR_TAGS.has(tag) && !seen.has(tag)) {
      seen.add(tag);
      found.push(tag);
    }
  }
  return found;
};

export const needsCodeView = (html) => unsupportedVisualTags(html).length > 0;
