// The Parallel Report's category taxonomy — single source of truth shared by
// the blog UI (pages/blog/BlogPage.jsx), the bot prerenderer (api/prerender.js)
// and the sitemap (api/sitemap.js). `slug` is what blog_articles.category
// stores in the database and what /blog/category/:slug URLs use; `label` is the
// human-readable name. Keep components/ArticleEditorModal.jsx's CATEGORIES
// (value/label) in sync when adding a category.
export const BLOG_CATEGORIES = [
  { slug: 'australia-focus',  label: 'Australia Focus',   desc: 'Australian trading card market and events' },
  { slug: 'beginner-guides',  label: 'Beginner Guides',   desc: 'Essential guides for new collectors and traders' },
  { slug: 'card-spotlight',   label: 'Card Spotlight',    desc: 'Deep dives into iconic and valuable cards' },
  { slug: 'grading-guides',   label: 'Grading Hub',       desc: 'Card grading standards and preparation guides' },
  { slug: 'investing-value',  label: 'Investing & Value', desc: 'Investment strategies and card valuation insights' },
  { slug: 'news-releases',    label: 'News & Releases',   desc: 'Latest TCG releases and industry news' },
];

export const BLOG_CATEGORY_MAP = Object.fromEntries(
  BLOG_CATEGORIES.map((c) => [c.slug, c])
);
