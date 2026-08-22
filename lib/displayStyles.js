/**
 * Display Styles — the registry for the Vault "Card Showcase Engine".
 *
 * Every vault listing carries a `display_style` (see the migration
 * 20260630000002_add_display_styles.sql). A single rendering component
 * (`components/vault/CardShowcase.jsx`) reads that value and applies the
 * matching visual treatment, so new styles can be added here without touching
 * the cards that render them.
 *
 * Which styles a user may *choose* depends on their subscription tier. Access
 * is cumulative: a higher tier unlocks everything below it, plus its own.
 *
 * This module is intentionally framework-agnostic (no React / lucide imports)
 * so the access logic stays trivially unit-testable. The picker attaches icons
 * by style key on the component side.
 */

// ── Subscription tiers ──────────────────────────────────────────────────────
// Order matters: index === access rank. Keep in sync with the DB CHECK
// constraint on profiles.subscription_tier.
export const TIER_ORDER = ['free', 'pro', 'premium', 'elite', 'ultimate'];

export const TIER_META = {
  free:     { key: 'free',     label: 'Free' },
  pro:      { key: 'pro',      label: 'Pro' },
  premium:  { key: 'premium',  label: 'Premium' },
  elite:    { key: 'elite',    label: 'Elite' },
  ultimate: { key: 'ultimate', label: 'Ultimate' },
};

export const DEFAULT_TIER = 'free';
export const DEFAULT_STYLE = 'classic';

/**
 * Display style registry. `accent` values are HSL triples that reference the
 * existing CSS theme tokens / brand palette so styles stay on-brand in both
 * light and dark mode. The actual visual effects live in cardShowcase.css,
 * keyed by `key`.
 */
export const DISPLAY_STYLES = [
  {
    key:         'classic',
    label:       'Classic Flat',
    tagline:     'Fast, clean marketplace view',
    description: 'A crisp, flat presentation. The default look — always available.',
    minTier:     'free',
    animated:    false,
    interactive: false,
  },
  {
    key:         'stand',
    label:       'Premium Stand',
    tagline:     'Black CardPop stand with a realistic shadow',
    description: 'The card sits on a sleek black CardPop display stand with a soft cast shadow and a gentle tilt.',
    minTier:     'pro',
    animated:    false,
    interactive: false,
  },
  {
    key:         'floating',
    label:       'Floating Showcase',
    tagline:     'Gentle float with ambient shadow',
    description: 'The card hovers with a slow floating motion and a soft ambient shadow beneath it.',
    minTier:     'pro',
    animated:    true,
    interactive: false,
  },
  {
    key:         'neon',
    label:       'Neon Glow',
    tagline:     'Pulsing neon aura in the brand red',
    description: 'The card radiates a soft neon glow that slowly breathes. Bold without touching the photo.',
    minTier:     'pro',
    animated:    true,
    interactive: false,
  },
  {
    key:         'glass',
    label:       'Glass Museum',
    tagline:     'Dark display with glass reflection',
    description: 'A premium dark cabinet with a glass reflection and a soft overhead spotlight.',
    minTier:     'premium',
    animated:    false,
    interactive: false,
  },
  {
    key:         'slab',
    label:       'Slab Display',
    tagline:     'Realistic graded-slab presentation',
    description: 'Wraps the card in a realistic PSA / BGS / SGC-style slab. Perfect for graded cards.',
    minTier:     'premium',
    animated:    false,
    interactive: false,
  },
  {
    key:         'spotlight',
    label:       'Spotlight',
    tagline:     'Dark stage with a sweeping spotlight',
    description: 'A dark gallery stage where a soft spotlight beam sweeps slowly across the card.',
    minTier:     'premium',
    animated:    true,
    interactive: false,
  },
  {
    key:         'rotating',
    label:       'Rotating Premium',
    tagline:     'Slow, premium back-and-forth rotation',
    description: 'The card rotates gently back and forth — never spinning. A refined, premium motion.',
    minTier:     'elite',
    animated:    true,
    interactive: false,
  },
  {
    key:         'spinning',
    label:       'Spinning Stand',
    tagline:     'Full 360° spin on the black CardPop stand',
    description: 'The card revolves continuously above a black CardPop turntable, showing off a branded card back as it turns.',
    minTier:     'elite',
    animated:    true,
    interactive: false,
  },
  {
    key:         'prism',
    label:       'Prism',
    tagline:     'Refracted rainbow light sweeps the card',
    description: 'A prismatic beam of refracted light drifts across the card like sunlight through glass.',
    minTier:     'elite',
    animated:    true,
    interactive: false,
  },
  {
    key:         'holographic',
    label:       'Holographic',
    tagline:     'Shine and rainbow follow the cursor',
    description: 'A holographic shine, reflection and rainbow that track the pointer as it moves.',
    minTier:     'ultimate',
    animated:    true,
    interactive: true,
  },
];

// Fast lookups
const STYLE_BY_KEY = DISPLAY_STYLES.reduce((acc, s) => {
  acc[s.key] = s;
  return acc;
}, {});

const VALID_STYLE_KEYS = new Set(DISPLAY_STYLES.map(s => s.key));

/**
 * Numeric access rank for a tier. Unknown / missing tiers fall back to the
 * lowest rank (free) so a bad value can never silently grant access.
 */
export const tierRank = (tier) => {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? 0 : idx;
};

/** Coerce any value to a known tier, defaulting to 'free'. */
export const normalizeTier = (tier) =>
  TIER_ORDER.includes(tier) ? tier : DEFAULT_TIER;

/** Coerce any value to a known style key, defaulting to 'classic'. */
export const normalizeStyle = (key) =>
  VALID_STYLE_KEYS.has(key) ? key : DEFAULT_STYLE;

/** Look up a style definition by key (returns undefined if unknown). */
export const getStyleByKey = (key) => STYLE_BY_KEY[key];

/**
 * Can a user on `userTier` use the style `styleKey`?
 * An unknown style is treated as the default ('classic'), which is always
 * allowed. An unknown tier is treated as 'free'.
 */
export const canUseStyle = (styleKey, userTier) => {
  const style = getStyleByKey(normalizeStyle(styleKey));
  return tierRank(userTier) >= tierRank(style.minTier);
};

/** All style definitions the given tier can use, in registry order. */
export const getAccessibleStyles = (userTier) => {
  const rank = tierRank(userTier);
  return DISPLAY_STYLES.filter(s => rank >= tierRank(s.minTier));
};

/**
 * The style to actually render for a listing: the stored style if the *owner*
 * is still entitled to it, otherwise the default. This keeps a downgraded
 * seller's listings from rendering a style they no longer pay for, without
 * mutating stored data. Pass the owner's tier; omit it to render as stored.
 */
export const resolveDisplayStyle = (storedStyle, ownerTier) => {
  const style = normalizeStyle(storedStyle);
  if (ownerTier == null) return style;
  return canUseStyle(style, ownerTier) ? style : DEFAULT_STYLE;
};
