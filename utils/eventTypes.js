// The kinds of event on the calendar and what an event can feature.
//
// Dependency-free: shared by the event form, the public pages, the admin list,
// the emails and the event scanner (src/utils/eventData.js), so every list of
// event types is this one. The `value`s are the `public.event_type` enum —
// adding one here needs an `alter type … add value` migration too
// (20261118…_event_type_more_kinds.sql).

export const EVENT_TYPES = [
  { value: 'card_show',         label: 'Card Show',               formLabel: 'Card Show' },
  { value: 'trade_event',       label: 'Trade Event',             formLabel: 'Trade Event' },
  { value: 'comic_toy_fair',    label: 'Comic & Toy Fair',        formLabel: 'Comic & Toy Fair' },
  { value: 'collectables_fair', label: 'Collectables Fair',       formLabel: 'Collectables Fair / Market' },
  { value: 'convention',        label: 'Pop Culture Convention',  formLabel: 'Pop Culture Convention / Expo' },
  { value: 'tournament',        label: 'Tournament',              formLabel: 'Tournament' },
  { value: 'community_event',   label: 'Community Event',         formLabel: 'Community Event' },
  { value: 'lgs_event',         label: 'Store Event',             formLabel: 'LGS (Local Game Store) Event' },
];

export const EVENT_TYPE_VALUES = EVENT_TYPES.map((t) => t.value);

export const EVENT_TYPE_LABELS = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]));

// What an event features — stored as plain strings in
// `events.featured_card_games` (text[]; the column kept its original name).
export const EVENT_FEATURE_GROUPS = [
  {
    label: 'Trading card games',
    options: [
      'Pokémon', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'One Piece', 'Flesh and Blood',
      'Lorcana', 'Dragon Ball', 'Star Wars: Unlimited', 'Digimon', 'Riftbound',
      'Gundam Card Game', 'Union Arena', 'Weiss Schwarz', 'Cardfight!! Vanguard', 'MetaZoo',
    ],
  },
  {
    label: 'Sports & collector cards',
    options: [
      'Sports Cards', 'AFL', 'NRL', 'NBA', 'NFL', 'Cricket', 'Soccer', 'UFC', 'WWE',
      'Formula 1', 'Non-Sport Cards', 'Graded Cards', 'Sealed Product',
    ],
  },
  {
    label: 'Collectables & pop culture',
    options: [
      'Comics', 'Toys & Action Figures', 'Funko Pops', 'LEGO', 'Die-cast & Model Cars',
      'Vintage & Retro', 'Retro Video Games', 'Anime & Manga', 'Movie & TV Memorabilia',
      'Sports Memorabilia', 'Coins, Stamps & Banknotes', 'Vinyl Records', 'Board Games',
      'Artists & Creators', 'Cosplay', 'Special Guests & Signings',
    ],
  },
];

export const EVENT_FEATURE_OPTIONS = EVENT_FEATURE_GROUPS.flatMap((g) => g.options);

export const MAX_EVENT_FEATURES = 40;
export const MAX_EVENT_FEATURE_LENGTH = 40;

// Trim, drop blanks and over-long entries, de-duplicate case-insensitively
// (keeping the listed spelling when there is one) and cap the count.
export function cleanEventFeatures(list) {
  if (!Array.isArray(list)) return [];
  const known = new Map(EVENT_FEATURE_OPTIONS.map((o) => [o.toLowerCase(), o]));
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_EVENT_FEATURE_LENGTH) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(known.get(key) || text);
    if (out.length >= MAX_EVENT_FEATURES) break;
  }
  return out;
}
