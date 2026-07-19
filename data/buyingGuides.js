// Buying Guides — editorial "what to chase in the newest sets" content that
// lives under the Analytics section (/analytics/buying-guides). Each guide
// covers a single freshly-released product and calls out its "chase cards" (the
// most valuable / most hyped cards in the set) to help collectors decide what to
// hunt when they crack packs or shop the marketplace.
//
// This is the single source of truth for the hub page
// (pages/analytics/BuyingGuidesPage.jsx), the detail page
// (pages/analytics/BuyingGuideDetailPage.jsx) and the sitemap. Content is
// curated by hand rather than pulled from an API — prices are indicative AUD
// guides only and are intentionally given as ranges, since new-release values
// move fast. Update the `updated` date whenever you refresh a guide's figures.
//
// Field reference for each guide:
//   slug        URL segment (/analytics/buying-guides/:slug) — keep stable
//   title       Full product name shown as the H1
//   shortTitle  Compact name for cards / breadcrumbs
//   category    'pokemon' | 'afl' | 'baseball' — drives the accent colour and,
//               for 'pokemon', enables live card-art lookups (pokemonSet)
//   game        Human-readable game/brand label ("Pokémon TCG", "AFL", …)
//   pokemonSet  (pokemon only) set name passed to the Pokémon TCG API for art
//   status      'available' | 'coming-soon' — badge on the card/hero
//   releaseDate ISO date the product hit shelves
//   releaseLabel Human "31 March 2026" for display
//   updated     ISO date this guide's figures were last checked
//   gradient    Tailwind bg-gradient-to-br pair for the hero / card accent
//   tagline     One-line hook under the title
//   summary     ~2 sentence overview shown on the hub card
//   overview[]  Paragraphs for the detail page intro
//   quickFacts[] {label,value} rows for the "at a glance" panel
//   chaseCards[] the headline of each guide — see field notes below
//   collectingTips[] short bullet advice
//   marketplaceQuery search string used for the "shop this set" CTA link
//
// chaseCards[] item fields:
//   name       Card name
//   subtitle   Rarity / variant / parallel descriptor
//   value      Indicative AUD range (string) or 'Chase' for uncapped
//   tier       'grail' | 'high' | 'mid' — controls the value-chip colour
//   blurb      Why this card is the one to chase
//   pokemonName (pokemon only) exact name to feed the TCG API image lookup

export const GUIDE_CATEGORY_META = {
  pokemon: {
    label: 'Pokémon TCG',
    gradient: 'from-amber-500 to-yellow-600',
  },
  afl: {
    label: 'AFL Footy',
    gradient: 'from-red-500 to-rose-600',
  },
  baseball: {
    label: 'Baseball',
    gradient: 'from-blue-500 to-indigo-600',
  },
};

export const BUYING_GUIDES = [
  // ─── Pokémon TCG — Mega Evolution: Pitch Black ──────────────────────────────
  {
    slug: 'pokemon-mega-evolution-pitch-black',
    title: 'Pokémon TCG — Mega Evolution: Pitch Black',
    shortTitle: 'Mega Evolution: Pitch Black',
    category: 'pokemon',
    game: 'Pokémon TCG',
    pokemonSet: 'Mega Evolution: Pitch Black',
    status: 'available',
    releaseDate: '2026-07-17',
    releaseLabel: '17 July 2026',
    updated: '2026-07-19',
    gradient: 'from-slate-800 to-purple-900',
    tagline: 'The darkest set of the Mega Evolution era has landed — and Darkrai is calling.',
    summary:
      'Pitch Black is the fifth Mega Evolution-era expansion, leaning into shadowy artwork and tying straight into Pokémon Legends Z-A. Mega Darkrai ex headlines a stacked chase list of Special Illustration and gold Hyper Rares.',
    overview: [
      'Mega Evolution: Pitch Black dropped on 17 July 2026 as the fifth expansion in the Mega Evolution era, built on Japan’s "Abyss Eye" set. It pushes the era into darker, moodier territory and links directly to Pokémon Legends Z-A: Mega Dimension.',
      'Six brand-new Mega Evolution ex Pokémon anchor the set — Mega Darkrai ex, Mega Zeraora ex, Mega Chandelure ex, Mega Excadrill ex, Mega Delphox ex and Mega Slowbro ex — with Mega Darkrai ex the clear headliner and early breakout chase.',
      'As with every modern set, the real value sits at the top of the rarity ladder: Special Illustration Rares (full-art, alternate scenes) and the gold Mega Hyper Rares are the cards pulling premium prices in the opening weeks.',
    ],
    quickFacts: [
      { label: 'Set', value: 'Mega Evolution: Pitch Black' },
      { label: 'Era', value: 'Mega Evolution (5th expansion)' },
      { label: 'Released', value: '17 July 2026' },
      { label: 'New Mega ex', value: '6 (Darkrai, Zeraora, Chandelure, Excadrill, Delphox, Slowbro)' },
      { label: 'Formats', value: 'Booster packs, ETB, Premium Collection' },
    ],
    chaseCards: [
      {
        name: 'Mega Darkrai ex',
        pokemonName: 'Darkrai ex',
        subtitle: 'Special Illustration Rare · art by Akira Egawa',
        value: '$180–$320',
        tier: 'grail',
        blurb:
          'The face of the set. Akira Egawa’s full-art scene is the card everyone is opening packs for — the SIR is the runaway chase and the one to grade if you pull a clean copy.',
      },
      {
        name: 'Mega Darkrai ex',
        pokemonName: 'Darkrai ex',
        subtitle: 'Gold Mega Hyper Rare',
        value: '$120–$220',
        tier: 'high',
        blurb:
          'The gold Hyper Rare sits at the very top of the rarity ladder. Lower print numbers than the SIR and a mirror-gold finish make it a long-term hold for Darkrai fans.',
      },
      {
        name: 'Mega Greninja ex',
        pokemonName: 'Greninja ex',
        subtitle: 'Premium Collection exclusive',
        value: '$60–$110',
        tier: 'high',
        blurb:
          'Not in the main booster pool — Mega Greninja ex headlines the Pitch Black Premium Collection box, so demand outstrips supply for one of the era’s most popular Pokémon.',
      },
      {
        name: 'Mega Chandelure ex',
        pokemonName: 'Chandelure ex',
        subtitle: 'Special Illustration Rare',
        value: '$45–$85',
        tier: 'mid',
        blurb:
          'A fan-favourite design that fits the set’s dark theme perfectly. Strong secondary-market interest and a striking SIR make it the best value chase after Darkrai.',
      },
      {
        name: 'Mega Delphox ex',
        pokemonName: 'Delphox ex',
        subtitle: 'Special Illustration Rare',
        value: '$35–$70',
        tier: 'mid',
        blurb:
          'The Kalos tie-in to Legends Z-A gives Delphox extra pull. A clean SIR is an approachable entry chase that still has room to climb as the set matures.',
      },
    ],
    collectingTips: [
      'Buy sealed early if you plan to grade — SIR and gold prices historically dip a few weeks after launch once supply floods in, then recover.',
      'The Premium Collection is the only route to Mega Greninja ex; factor that into whether you rip boosters or buy singles.',
      'Grade candidates centred and edge-clean — modern SIRs are notorious for print lines and silvering that cap them at a PSA 9.',
    ],
    marketplaceQuery: 'Mega Evolution Pitch Black',
  },

  // ─── AFL Teamcoach 2026 ─────────────────────────────────────────────────────
  {
    slug: 'afl-teamcoach-2026',
    title: '2026 AFL Teamcoach',
    shortTitle: 'AFL Teamcoach 2026',
    category: 'afl',
    game: 'AFL',
    status: 'available',
    releaseDate: '2026-03-31',
    releaseLabel: '31 March 2026',
    updated: '2026-07-19',
    gradient: 'from-red-600 to-rose-800',
    tagline: 'Australia’s favourite footy set is back — from Common base to Gold chase.',
    summary:
      'The 2026 Teamcoach range packs base, Silver and Gold cards alongside the insert series collectors actually chase — Star Powers, Wildcards and Card Craft. Boxes run 36 packs of 9, so there’s plenty to hunt.',
    overview: [
      '2026 AFL Teamcoach landed on 31 March 2026, once again the go-to mainstream footy set for Australian collectors — affordable, everywhere, and stacked with kids-to-serious-collector appeal.',
      'The base set spans Common, Silver and Gold parallels of every listed player, plus the strategy "game" cards Teamcoach is known for. Boxes contain 36 packs of 9 cards, giving strong odds at the base parallels but keeping the premium inserts genuinely tough.',
      'The value lives in the insert series: Star Powers, Wildcards, Card Craft, Best & Fairest, Future Legends, Footy Flix and the throwback Scanlens cards. Signed and low-numbered versions of the biggest names are where the real money sits.',
    ],
    quickFacts: [
      { label: 'Set', value: '2026 AFL Teamcoach' },
      { label: 'Released', value: '31 March 2026' },
      { label: 'Box config', value: '36 packs × 9 cards' },
      { label: 'Base tiers', value: 'Common · Silver · Gold' },
      { label: 'Insert series', value: 'Star Powers, Wildcards, Card Craft, Best & Fairest, Future Legends, Footy Flix, Scanlens' },
    ],
    chaseCards: [
      {
        name: 'Star Powers',
        subtitle: 'Premium foil insert · marquee players',
        value: '$40–$150+',
        tier: 'grail',
        blurb:
          'The headline chase every year. Star Powers pull the league’s biggest names in a premium foil finish — Brownlow contenders and superstars command the top prices, especially in top-loaded gem condition.',
      },
      {
        name: 'Wildcards',
        subtitle: 'Short-print insert',
        value: '$25–$90',
        tier: 'high',
        blurb:
          'Tougher pull odds and bold artwork make Wildcards a collector staple. Star-team players hold value strongly on the secondary market well after release.',
      },
      {
        name: 'Card Craft',
        subtitle: 'Die-cut / premium insert',
        value: '$20–$70',
        tier: 'high',
        blurb:
          'The most visually striking insert in the range — the die-cut styling makes these the display-piece chase, and clean copies of top players sell fast.',
      },
      {
        name: 'Future Legends',
        subtitle: 'Rising-star insert',
        value: '$15–$60',
        tier: 'mid',
        blurb:
          'The rookie/young-gun subset. These are the speculative chase — grab the breakout first-year names before a big season sends their card climbing.',
      },
      {
        name: 'Scanlens',
        subtitle: 'Retro throwback insert',
        value: '$15–$50',
        tier: 'mid',
        blurb:
          'A nostalgia play on the classic Scanlens design. Popular with long-time collectors and a nice-value chase that rounds out a 2026 master set.',
      },
    ],
    collectingTips: [
      'Star Powers of Brownlow and premiership favourites climb through the season — buy the player before the form guide catches up.',
      'A full box (36 packs) is the sweet spot for chasing the base Gold parallels without singles-hunting every player.',
      'Condition matters more than people think on footy cards — factory edges and centring are the difference between a $40 and a $150 Star Power.',
    ],
    marketplaceQuery: 'AFL Teamcoach 2026',
  },

  // ─── 2026 Topps Series 2 Baseball ───────────────────────────────────────────
  {
    slug: 'topps-series-2-2026-baseball',
    title: '2026 Topps Series 2 Baseball',
    shortTitle: 'Topps Series 2 2026',
    category: 'baseball',
    game: 'Baseball',
    status: 'available',
    releaseDate: '2026-06-10',
    releaseLabel: '10 June 2026',
    updated: '2026-07-19',
    gradient: 'from-blue-600 to-indigo-800',
    tagline: 'Topps’ 75th anniversary flagship — a loaded rookie class and the return of the 1952 variations.',
    summary:
      'Series 2 celebrates 75 years of Topps with one of the strongest rookie classes in years, headlined by Roman Anthony. Chase the flagship rookies, 1952 Topps variations and the short-print insert battery.',
    overview: [
      '2026 Topps Series 2 released on 10 June 2026 as part of Topps’ 75th-anniversary year — the flagship set collectors build around, and this year it arrived with an unusually deep rookie class.',
      'Roman Anthony leads the rookie charge alongside Trey Yesavage, Tatsuya Imai, Munetaka Murakami and Jac Caglianone. Flagship base rookie cards are the foundation chase, with autograph variations and short prints layered on top.',
      'The anniversary hook is the return of the 1952 Topps Rookie Variations on select rookies, plus the usual short-print battery — Home Field Advantage, Heavy Lumber and Golden Mirror cards — that keeps case-breakers hunting.',
    ],
    quickFacts: [
      { label: 'Set', value: '2026 Topps Series 2' },
      { label: 'Released', value: '10 June 2026' },
      { label: 'Milestone', value: '75 years of Topps baseball' },
      { label: 'Top rookies', value: 'Roman Anthony, Trey Yesavage, Tatsuya Imai, Munetaka Murakami, Jac Caglianone' },
      { label: 'Key inserts', value: '1952 Topps Variations, Home Field Advantage, Heavy Lumber, Golden Mirror' },
    ],
    chaseCards: [
      {
        name: 'Roman Anthony',
        subtitle: 'Flagship rookie · base + autograph variations',
        value: '$25–$250+',
        tier: 'grail',
        blurb:
          'The rookie of the release. The base RC is affordable, but the autograph and 1952 variation versions are the true grails — Anthony is the name driving Series 2 demand.',
      },
      {
        name: 'Trey Yesavage',
        subtitle: 'Rookie card · SP + auto',
        value: '$15–$120',
        tier: 'high',
        blurb:
          'A top pitching rookie whose short-print and autograph cards are among the most chased pulls in the set. High ceiling if the season goes his way.',
      },
      {
        name: 'Munetaka Murakami',
        subtitle: 'Rookie card',
        value: '$12–$90',
        tier: 'high',
        blurb:
          'The NPB slugger’s MLB flagship rookie carries strong international demand — a standout chase for collectors betting on power numbers.',
      },
      {
        name: '1952 Topps Rookie Variations',
        subtitle: 'Anniversary short-print variation',
        value: '$30–$200',
        tier: 'high',
        blurb:
          'The 75th-anniversary centrepiece. These short-printed 1952-design variations only appear on select rookies, making the top names genuinely hard to pull and highly collectible.',
      },
      {
        name: 'Home Field Advantage',
        subtitle: 'Short-print insert',
        value: '$10–$60',
        tier: 'mid',
        blurb:
          'A returning fan-favourite SP insert. Star and rookie versions hold value well and are an accessible way into the set’s chase list.',
      },
    ],
    collectingTips: [
      'Konnor Griffin and a few other big names are held for Topps Update — don’t overpay chasing a Series 2 rookie that isn’t in the checklist.',
      'The base rookie cards are cheap now; grade the well-centred copies of Anthony and Yesavage before a breakout season moves them.',
      '1952 variations are the anniversary play — verify the design details carefully, as they’re easy to miss against the base card.',
    ],
    marketplaceQuery: 'Topps Series 2 2026',
  },
];

export const BUYING_GUIDE_MAP = Object.fromEntries(
  BUYING_GUIDES.map((g) => [g.slug, g])
);

export const getBuyingGuide = (slug) => BUYING_GUIDE_MAP[slug] || null;
