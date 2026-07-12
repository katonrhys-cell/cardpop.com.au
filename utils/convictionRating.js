// The CardPop Conviction Rating™ — single source of truth for the 1–5 strength
// meter shown on research articles. Imported by the blog list (BlogPage), the
// article page (BlogArticlePage), the article editor (ArticleEditorModal) and
// the methodology page (/conviction-rating) so the scale can never drift
// between them.
//
// The rating is ONE-DIRECTIONAL: higher = stronger conviction, NOT "more
// bullish vs bearish". The five levels are universal — they always answer
// "how strong is our conviction?". What that conviction is ABOUT — and the
// action each level implies — depends on the rating TYPE, which is fixed by
// the article's category.

// ── The five levels (universal, plain-strength, cool→hot) ─────────────────
// Index 0 is unused so a rating of N maps directly to CONVICTION_LEVELS[N].
export const CONVICTION_LEVELS = [
  null,
  {
    value: 1,
    label: 'Minimal',
    colour: '#64748b', // slate — coolest
    blurb: 'Barely any conviction. We looked closely and would steer clear for now.',
  },
  {
    value: 2,
    label: 'Low',
    colour: '#0891b2', // cyan
    blurb: 'Weak conviction. Interesting, but the risks or unknowns outweigh the case today.',
  },
  {
    value: 3,
    label: 'Moderate',
    colour: '#d97706', // amber
    blurb: 'Solid, balanced conviction. A fair call with real caveats — conditions matter.',
  },
  {
    value: 4,
    label: 'High',
    colour: '#ea580c', // orange
    blurb: 'Strong conviction. A clear, well-evidenced call we stand behind.',
  },
  {
    value: 5,
    label: 'Highest',
    colour: '#dc2626', // red — hottest
    blurb: 'Our highest conviction. A rare, standout, table-pounding call.',
  },
];

// ── The rating types (subject + per-level action) ─────────────────────────
// actions[N] is the plain-language call for a level-N rating of this type.
export const CONVICTION_TYPES = {
  buy: {
    key: 'buy',
    name: 'Buy Conviction',
    short: 'Buy',
    question: 'How strongly should you accumulate this now?',
    actions: [
      null,
      'Avoid — sell into strength',
      'Watch only — no rush',
      'Nibble — small, staggered buys',
      'Accumulate on dips',
      'Back up the truck — core holding',
    ],
  },
  keeper: {
    key: 'keeper',
    name: 'Keeper Conviction',
    short: 'Keeper',
    question: 'How strongly does this belong in a serious collection?',
    actions: [
      null,
      'Flip it — not a keeper',
      'Optional — only if it fits your PC',
      'Nice-to-have — a solid role player',
      'Keeper — anchor your collection',
      'Grail — chase it and hold',
    ],
  },
  grade: {
    key: 'grade',
    name: 'Grade Conviction',
    short: 'Grade',
    question: 'How strongly is this worth submitting to grade?',
    actions: [
      null,
      "Don't grade — raw is fine",
      "Only if it's already near-mint",
      'Grade if you can realistically hit a 9+',
      'Worth grading — the graded premium is real',
      'Grade it now — the raw-to-slab gap is huge',
    ],
  },
  impact: {
    key: 'impact',
    name: 'Impact Conviction',
    short: 'Impact',
    question: 'How strongly will this news move the market?',
    actions: [
      null,
      'Noise — no real market impact',
      'Minor ripple — niche interest',
      'Worth noting — moves a few cards',
      'Significant — expect real price action',
      'Market-moving — act before the crowd',
    ],
  },
};

export const CONVICTION_TYPE_KEYS = Object.keys(CONVICTION_TYPES);

// ── Fixed category → type mapping ("type tied to category") ────────────────
// Keys are the editor's category slugs. Categories not listed here (e.g.
// 'beginner-guides') carry no rating — they show a read-time cue instead.
export const CATEGORY_CONVICTION_TYPE = {
  'investing-value': 'buy',
  'australia-focus': 'buy',
  'card-spotlight': 'keeper',
  'grading-guides': 'grade',
  'news-releases': 'impact',
};

// The conviction type a given category slug implies, or null if none.
export const convictionTypeForCategory = (category) =>
  CATEGORY_CONVICTION_TYPE[category] || null;

// Resolve an article into everything the meter needs, or null when the article
// carries no valid rating. `conviction_type` on the row wins; otherwise we fall
// back to the category mapping, then to 'buy' so a rating always renders.
export const resolveConviction = (article) => {
  const rating = Number(article?.conviction_rating);
  if (!(rating >= 1 && rating <= 5)) return null;

  const typeKey =
    article?.conviction_type ||
    convictionTypeForCategory(article?.category) ||
    'buy';
  const type = CONVICTION_TYPES[typeKey] || CONVICTION_TYPES.buy;
  const level = CONVICTION_LEVELS[rating];

  return {
    rating,
    level,
    type,
    label: level.label,
    colour: level.colour,
    blurb: level.blurb,
    action: type.actions[rating],
  };
};

// Route of the canonical "how the rating works" methodology page. Every meter
// links here — it's the article a reader must read to understand the scale.
export const CONVICTION_METHODOLOGY_PATH = '/conviction-rating';
