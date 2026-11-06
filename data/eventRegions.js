/**
 * Card-show landing pages by city — /card-shows/<city>.
 *
 * One page per state, named for its capital because that is what collectors
 * search ("card shows melbourne", "pokemon card show brisbane"). Each page
 * lists every upcoming approved event in the state — the capital plus the
 * regional towns named in `nearby` — so the copy says "Melbourne & Victoria",
 * never implies every event is in the capital.
 *
 * Shared by the SPA (pages/community/CommunityEventsPage.jsx via
 * EventRegionPage), the bot prerender (api/prerender.js) and the sitemap
 * (api/sitemap.js), so all three agree on slugs and copy. Dependency-free.
 *
 * Never put a count or a claim the DB doesn't back in `intro`: the page
 * states how many events are listed from the live query.
 */

export const EVENT_REGION_BASE = '/card-shows';

export const EVENT_REGIONS = [
  {
    slug: 'melbourne', state: 'VIC', city: 'Melbourne', stateName: 'Victoria',
    nearby: ['Geelong', 'Ballarat', 'Bendigo', 'Mornington Peninsula'],
    intro: 'Melbourne hosts some of the biggest trading card shows in the country, from national shows at Marvel Stadium to monthly collector fairs and game-store tournaments across the suburbs.',
  },
  {
    slug: 'sydney', state: 'NSW', city: 'Sydney', stateName: 'New South Wales',
    nearby: ['Newcastle', 'Wollongong', 'Central Coast', 'Penrith'],
    intro: 'Sydney and greater New South Wales run card expos, sports card shows and Pokémon, Magic and One Piece tournaments most weekends, with regular events out west and up the coast.',
  },
  {
    slug: 'brisbane', state: 'QLD', city: 'Brisbane', stateName: 'Queensland',
    nearby: ['Gold Coast', 'Sunshine Coast', 'Toowoomba', 'Townsville', 'Cairns'],
    intro: 'Brisbane, the Gold Coast and the Sunshine Coast have a busy card calendar, from trading card fairs and swap meets to store events across regional Queensland.',
  },
  {
    slug: 'adelaide', state: 'SA', city: 'Adelaide', stateName: 'South Australia',
    nearby: ['Mount Barker', 'Victor Harbor', 'Port Adelaide'],
    intro: 'Adelaide’s collector scene runs card shows, trade nights and TCG tournaments through the year, with local game stores at its centre.',
  },
  {
    slug: 'perth', state: 'WA', city: 'Perth', stateName: 'Western Australia',
    nearby: ['Fremantle', 'Joondalup', 'Mandurah', 'Bunbury'],
    intro: 'Perth and Western Australia hold card shows, sports card meets and game-store tournaments, so collectors on the west coast don’t have to fly east to trade in person.',
  },
  {
    slug: 'hobart', state: 'TAS', city: 'Hobart', stateName: 'Tasmania',
    nearby: ['Launceston', 'Devonport', 'Burnie'],
    intro: 'Tasmania’s card events run in Hobart and Launceston, from store tournaments to collector meet-ups.',
  },
  {
    slug: 'canberra', state: 'ACT', city: 'Canberra', stateName: 'the ACT',
    nearby: ['Queanbeyan', 'Belconnen', 'Tuggeranong'],
    intro: 'Canberra’s card community meets at game-store tournaments, trade nights and the occasional card show across the ACT.',
  },
  {
    slug: 'darwin', state: 'NT', city: 'Darwin', stateName: 'the Northern Territory',
    nearby: ['Palmerston', 'Alice Springs'],
    intro: 'Darwin and the Northern Territory have a small, active card scene centred on local game stores and community meet-ups.',
  },
];

const BY_SLUG = new Map(EVENT_REGIONS.map((r) => [r.slug, r]));
const BY_STATE = new Map(EVENT_REGIONS.map((r) => [r.state, r]));

export const eventRegionBySlug = (slug) => BY_SLUG.get(String(slug || '').toLowerCase()) || null;
export const eventRegionByState = (state) => BY_STATE.get(String(state || '').toUpperCase()) || null;
export const eventRegionPath = (region) => `${EVENT_REGION_BASE}/${region.slug}`;

/** "Melbourne & Victoria" — how titles and headings name the region. */
export const eventRegionLabel = (region) => `${region.city} & ${region.stateName}`;

export const eventRegionSeo = (region) => {
  const year = new Date().getFullYear();
  return {
    path: eventRegionPath(region),
    title: `Card Shows in ${region.city} ${year} | Trading Card Events ${region.state} | CardPop`,
    description: `Upcoming trading card shows, expos, swap meets and TCG tournaments in ${region.city} and across ${region.stateName}${region.nearby.length ? ` (${region.nearby.slice(0, 3).join(', ')} and more)` : ''}. Dates, venues and tickets for Pokémon, sports card and Magic collectors.`,
    heading: `Card Shows in ${region.city}`,
    subheading: `Trading card shows, swap meets and tournaments in ${region.city} and across ${region.stateName}.`,
  };
};

/** States (VIC, NSW…) that have at least one upcoming event in `events`. */
export const regionsWithEvents = (events, today) => {
  const states = new Set();
  for (const ev of events || []) {
    if (ev?.status !== 'approved' || !ev.state) continue;
    const last = String(ev.end_date || ev.start_date || '');
    if (!last || (today && last.slice(0, 10) < today)) continue;
    states.add(String(ev.state).toUpperCase());
  }
  return EVENT_REGIONS.filter((r) => states.has(r.state));
};
