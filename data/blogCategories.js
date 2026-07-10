// The Parallel Report's category taxonomy — single source of truth shared by
// the blog UI (pages/blog/BlogPage.jsx), the bot prerenderer (api/prerender.js)
// and the sitemap (api/sitemap.js). `slug` is what blog_articles.category
// stores in the database and what /blog/category/:slug URLs use; `label` is the
// human-readable name. `gradient` is the Tailwind `bg-gradient-to-br` pair that
// colours the category — it matches the icon badge for the same category in the
// Blog nav dropdown (components/HeaderMenus.jsx) so the category pills on blog
// cards read in the same colour as their dropdown icon. Keep
// components/ArticleEditorModal.jsx's CATEGORIES (value/label) in sync when
// adding a category.
export const BLOG_CATEGORIES = [
  { slug: 'australia-focus',  label: 'Australia Focus',   desc: 'Australian trading card market and events',       gradient: 'from-green-500 to-emerald-600'  },
  { slug: 'beginner-guides',  label: 'Beginner Guides',   desc: 'Essential guides for new collectors and traders', gradient: 'from-blue-500 to-indigo-600'    },
  { slug: 'card-spotlight',   label: 'Card Spotlight',    desc: 'Deep dives into iconic and valuable cards',       gradient: 'from-yellow-500 to-orange-500'  },
  { slug: 'grading-guides',   label: 'Grading Hub',       desc: 'Card grading standards and preparation guides',   gradient: 'from-purple-500 to-violet-600'  },
  { slug: 'investing-value',  label: 'Investing & Value', desc: 'Investment strategies and card valuation insights', gradient: 'from-rose-500 to-pink-600'    },
  { slug: 'news-releases',    label: 'News & Releases',   desc: 'Latest TCG releases and industry news',           gradient: 'from-cyan-500 to-sky-600'      },
];

export const BLOG_CATEGORY_MAP = Object.fromEntries(
  BLOG_CATEGORIES.map((c) => [c.slug, c])
);
