/**
 * Per-collection configuration.
 * Each entry drives the CollectionPage template — hero theme, SEO copy,
 * era/brand strips, and page accent colours.
 *
 * categoryName must match the `name` field in the PocketBase `categories`
 * collection (case-sensitive).  Add aliases in the `categoryAliases` array
 * if the DB uses alternate spellings.
 */

import {
  CaptureSphereIcon, ArcaneGemIcon, MysticEyeIcon, NauticalAnchorIcon,
  MagicDropIcon, StarOrbIcon, DigitalBadgeIcon, CourtBallIcon,
  TrophyCupIcon, CrystalIcon, RiftPortalIcon, TurtleShellIcon,
  NBLBallIcon, AmericanFootballIcon, BaseballIcon, CricketIcon,
  RugbyBallIcon, AFLBallIcon, CheckeredFlagIcon, GolfIcon,
  SoccerBallIcon, TennisBallIcon, ChampionBeltIcon, OctagonIcon, HockeyIcon,
} from '@/components/CategoryIcons.jsx';

// ── Helper to build an era badge entry ───────────────────────────────────────
const era = (name, years, gradient, hint = '') => ({ name, years, gradient, hint });

// ─────────────────────────────────────────────────────────────────────────────
//  COLLECTION CONFIGS
// ─────────────────────────────────────────────────────────────────────────────
export const COLLECTION_CONFIGS = {

  // ── Pokémon ────────────────────────────────────────────────────────────────
  pokemon: {
    slug: 'pokemon',
    name: 'Pokémon',
    categoryAliases: ['Pokemon', 'Pokémon TCG', 'pokemon'],
    tagline: 'Catch the Rarest Cards in Australia',
    seoTitle: 'Pokémon Cards for Sale in Australia | CardPop',
    seoDescription:
      'Buy, sell and trade Pokémon Trading Card Game singles and sealed products from verified Australian sellers. Browse vintage holos, PSA-graded slabs, and the latest Scarlet & Violet expansions — all priced in AUD.',
    seoIntro:
      'The Pokémon Trading Card Game has captivated collectors worldwide since 1999. From the iconic Base Set Charizard to the crown-jewels of modern Scarlet & Violet, Australian collectors have always been among the most passionate on the planet. CardPop is Australia\'s home for Pokémon cards — connecting buyers and sellers across every state with secure escrow trading, real-time market data, and a community of verified collectors who live and breathe the game. Whether you\'re hunting a PSA 10 Shadowless Blastoise or picking up the latest Paldea Evolved booster display, you\'ll find it here.',
    // Hero visual theme
    heroGradient: 'from-yellow-300 via-amber-300 to-yellow-500',
    heroTextDark: true,
    accentHex: '#F59E0B',
    badgeGradient: 'from-yellow-300 to-yellow-500',
    Icon: CaptureSphereIcon,
    // Era / brand navigation
    eras: [
      era('Scarlet & Violet', '2023–Now',   'from-violet-500 to-fuchsia-600',   'The latest generation — Paldea, Kitakami & Blueberry eras.'),
      era('Crown Zenith',     '2023',        'from-cyan-400 to-blue-500',         'A premium VSTAR Universe-style set with stunning alt arts.'),
      era('Sword & Shield',   '2020–2023',   'from-blue-500 to-indigo-600',       'V, VMAX & VSTAR era — home of the iconic alt-art Umbreon.'),
      era('Sun & Moon',       '2017–2019',   'from-orange-400 to-amber-500',      'GX era featuring full-art rainbow rares.'),
      era('XY Series',        '2013–2017',   'from-teal-500 to-cyan-600',         'EX era — Mega Evolutions and vintage holos.'),
      era('Black & White',    '2011–2013',   'from-gray-600 to-slate-700',        'Full Art Supporters debut — a fan-favourite era.'),
      era('HeartGold SS',     '2010–2011',   'from-yellow-500 to-amber-600',      'Legendary & Prime cards — highly sought after.'),
      era('Base Set Era',     '1999–2003',   'from-stone-500 to-amber-700',       'The originals — Base Set, Jungle, Fossil & beyond.'),
    ],
    holyGrailLabel: 'Legendary Pulls',
    holyGrailDesc:  'CardPop-curated Pokémon cards worth chasing — hand-picked for condition, rarity, and value.',
    showGradedSection: true,
    showTrendingSection: true,
  },

  // ── Magic: The Gathering ───────────────────────────────────────────────────
  magic: {
    slug: 'magic',
    name: 'Magic: The Gathering',
    categoryAliases: ['Magic: The Gathering', 'Magic', 'MTG'],
    tagline: 'Command the Most Powerful Cards in the Multiverse',
    seoTitle: 'Magic: The Gathering Cards Australia | CardPop',
    seoDescription:
      'Buy and sell MTG singles, sealed product and Commander staples from verified Australian sellers. Browse Standard, Pioneer, Modern and Legacy formats — priced in AUD.',
    seoIntro:
      'Magic: The Gathering is the world\'s premier trading card game — a vast, ever-expanding multiverse spanning over 30 years of iconic cards. From the legendary Power Nine to the latest Bloomburrow and Duskmourn sets, Australian Magic players demand the best. CardPop connects you with verified local sellers for singles, sealed product, and rare foils across all formats and eras.',
    heroGradient: 'from-purple-600 via-violet-500 to-purple-800',
    heroTextDark: false,
    accentHex: '#7C3AED',
    badgeGradient: 'from-purple-500 to-violet-700',
    Icon: ArcaneGemIcon,
    eras: [
      era('Standard',     'Current',   'from-green-500 to-teal-600',     'Rotating format — newest sets only.'),
      era('Pioneer',      '2012–Now',  'from-blue-500 to-indigo-600',    'Non-rotating from Return to Ravnica onwards.'),
      era('Modern',       '2003–Now',  'from-orange-500 to-amber-600',   'Powerful format from 8th Edition onwards.'),
      era('Legacy',       'All Sets',  'from-red-600 to-rose-700',       'Unrestricted — nearly every card ever printed.'),
      era('Commander',    'All Sets',  'from-purple-500 to-fuchsia-600', 'The most popular casual format worldwide.'),
      era('Vintage',      'All Sets',  'from-gray-700 to-slate-800',     'Includes the Power Nine — the most powerful cards.'),
      era('Special Sets', 'Various',   'from-yellow-400 to-amber-500',   'Mystery Booster, Secret Lair & more.'),
    ],
    holyGrailLabel: 'Power Picks',
    holyGrailDesc:  'The most sought-after MTG singles on CardPop — from format staples to collector\'s treasures.',
  },

  // ── Yu-Gi-Oh! ─────────────────────────────────────────────────────────────
  yugioh: {
    slug: 'yugioh',
    name: 'Yu-Gi-Oh!',
    categoryAliases: ['Yu-Gi-Oh', 'Yu-Gi-Oh!', 'YuGiOh', 'Yugioh'],
    tagline: 'It\'s Time to Duel — Find Your Rarest Cards',
    seoTitle: 'Yu-Gi-Oh! Cards Australia | CardPop',
    seoDescription:
      'Browse Yu-Gi-Oh! singles, tournament staples and vintage pieces from verified Australian sellers. Buy and sell in AUD with confidence.',
    seoIntro:
      'Yu-Gi-Oh! has been capturing duelists\' imaginations since 1999. From the original Legend of Blue Eyes White Dragon to the latest Age of Overlord, Australian collectors have a deep passion for rare ghost rares, prismatic secret rares, and vintage 1st Edition power cards.',
    heroGradient: 'from-amber-400 via-yellow-400 to-amber-500',
    heroTextDark: true,
    accentHex: '#D97706',
    badgeGradient: 'from-amber-300 to-amber-500',
    Icon: MysticEyeIcon,
    eras: [
      era('Master Duel Era',   '2022–Now',  'from-purple-500 to-violet-700', 'Modern competitive meta.'),
      era('Rush Duel',         '2020–Now',  'from-red-500 to-orange-600',    'Speed-focused alternative format.'),
      era('Link Era',          '2017–Now',  'from-blue-500 to-indigo-600',   'Link Summoning mechanics.'),
      era('Pendulum Era',      '2013–2017', 'from-teal-400 to-cyan-600',     'Pendulum Scales and Zones.'),
      era('XYZ/Synchro Era',   '2008–2013', 'from-sky-400 to-blue-500',      'Extra Deck power era.'),
      era('Classic (DM Era)',  '1999–2007', 'from-stone-500 to-amber-700',   'Original Dark Magician era — vintage gold.'),
    ],
    holyGrailLabel: 'God Cards & Gems',
    holyGrailDesc:  'The rarest Yu-Gi-Oh! singles on CardPop — from vintage 1st Editions to trophy-level alt arts.',
  },

  // ── Dragon Ball ────────────────────────────────────────────────────────────
  dragonball: {
    slug: 'dragonball',
    name: 'Dragon Ball',
    categoryAliases: ['Dragon Ball', 'Dragon Ball Super', 'DBS'],
    tagline: 'Power Up Your Collection',
    seoTitle: 'Dragon Ball Super Card Game Australia | CardPop',
    seoDescription: 'Buy and sell Dragon Ball Super Card Game singles and sealed product from verified Australian sellers.',
    seoIntro: 'The Dragon Ball Super Card Game brings Goku, Vegeta, and the whole Z-Fighter roster to the tabletop. Australian collectors love the stunning Full Art Awakened cards and the chase pieces from premium anniversary sets.',
    heroGradient: 'from-orange-400 via-orange-300 to-amber-400',
    heroTextDark: true,
    accentHex: '#F97316',
    badgeGradient: 'from-orange-400 to-orange-600',
    Icon: StarOrbIcon,
    eras: [
      era('Fusion World',     '2024–Now',  'from-blue-500 to-violet-600',    'Latest series expansion.'),
      era('Unison Warriors',  '2021–2023', 'from-red-500 to-orange-600',     'Evolved gameplay era.'),
      era('Galactic Battle',  '2017–2019', 'from-orange-400 to-amber-500',   'The original series launch.'),
    ],
    holyGrailLabel: 'Super Rare Pulls',
    holyGrailDesc:  'The ultimate Dragon Ball cards for collectors — Awakened leaders, Special Rares, and beyond.',
  },

  // ── One Piece ─────────────────────────────────────────────────────────────
  onepiece: {
    slug: 'onepiece',
    name: 'One Piece',
    categoryAliases: ['One Piece', 'One Piece Card Game', 'OPCG'],
    tagline: 'Set Sail for the Rarest Cards',
    seoTitle: 'One Piece Card Game Australia | CardPop',
    seoDescription: 'Buy and sell One Piece Card Game singles from verified Australian sellers. Browse Monkey D. Luffy alt arts and Secret Rares in AUD.',
    seoIntro: 'The One Piece Card Game has taken Australia by storm since its 2022 launch. With stunning Secret Rare alt arts and the explosive chase for Luffy\'s landmark Special Cards, demand has never been higher. Shop verified singles and sealed product from Aussie collectors.',
    heroGradient: 'from-red-500 via-rose-500 to-red-700',
    heroTextDark: false,
    accentHex: '#EF4444',
    badgeGradient: 'from-red-500 to-rose-700',
    Icon: NauticalAnchorIcon,
    eras: [
      era('Awakening of the New Era', '2024–Now',  'from-purple-500 to-violet-700', 'Latest expansion wave.'),
      era('Wings of the Captain',     '2023–2024', 'from-blue-500 to-indigo-600',   'Fan-favourite block.'),
      era('Romance Dawn',             '2022–2023', 'from-red-500 to-rose-700',      'The original launch series.'),
    ],
    holyGrailLabel: 'Secret Rare Treasures',
    holyGrailDesc:  'The most valuable One Piece singles on CardPop — Secret Rares, alt arts, and graded slabs.',
  },

  // ── Disney Lorcana ────────────────────────────────────────────────────────
  lorcana: {
    slug: 'lorcana',
    name: 'Disney Lorcana',
    categoryAliases: ['Disney Lorcana', 'Lorcana'],
    tagline: 'Into the Inklands — Collect the Magic',
    seoTitle: 'Disney Lorcana Cards Australia | CardPop',
    seoDescription: 'Buy and sell Disney Lorcana singles from verified Australian sellers. Browse Enchanted rares and foils from every chapter.',
    seoIntro: 'Disney Lorcana has enchanted collectors since its 2023 debut. The stunning Enchanted rarity cards — with their unique portrait-style art — have become the crown jewels of the hobby. Find every chapter from The First Chapter to Azurite Sea and beyond on CardPop.',
    heroGradient: 'from-blue-400 via-indigo-400 to-blue-600',
    heroTextDark: false,
    accentHex: '#4F46E5',
    badgeGradient: 'from-blue-400 to-indigo-600',
    Icon: MagicDropIcon,
    eras: [
      era('Azurite Sea',         '2025–Now',  'from-teal-400 to-cyan-600',     'Latest chapter.'),
      era('Shimmering Skies',    '2024',      'from-sky-400 to-blue-500',       'Fan-favourite aerial set.'),
      era('Ursula\'s Return',    '2024',      'from-purple-600 to-violet-800',  'Villain-focused chapter.'),
      era('Into the Inklands',   '2024',      'from-green-500 to-teal-600',     'Exploration chapter.'),
      era('Rise of the Floodborn','2023',     'from-indigo-500 to-purple-600',  'Floodborn variant art era.'),
      era('The First Chapter',   '2023',      'from-blue-500 to-indigo-600',    'The original launch — most valuable Enchanteds.'),
    ],
    holyGrailLabel: 'Enchanted Rarities',
    holyGrailDesc:  'The rarest Disney Lorcana cards on CardPop — Enchanted rares, foil variants, and promo gems.',
  },

  // ── Digimon ───────────────────────────────────────────────────────────────
  digimon: {
    slug: 'digimon',
    name: 'Digimon',
    categoryAliases: ['Digimon', 'Digimon Card Game', 'DCG'],
    tagline: 'Digivolve Your Collection',
    seoTitle: 'Digimon Card Game Australia | CardPop',
    seoDescription: 'Buy and sell Digimon Card Game singles from verified Australian sellers. Browse Alternate Art Digimon in AUD.',
    seoIntro: 'The Digimon Card Game has built one of the most passionate communities in Australia. With breathtaking alternate art cards and a growing competitive scene, it\'s the perfect time to start or expand your collection.',
    heroGradient: 'from-sky-400 via-cyan-400 to-sky-600',
    heroTextDark: false,
    accentHex: '#0EA5E9',
    badgeGradient: 'from-sky-400 to-cyan-600',
    Icon: DigitalBadgeIcon,
    eras: [
      era('Exceed Apocalypse', '2024–Now',  'from-red-500 to-orange-600',  'Latest booster wave.'),
      era('Double Diamond',    '2022–2023', 'from-blue-500 to-indigo-600', 'Most sought-after alt arts.'),
      era('New Evolution',     '2020–2021', 'from-teal-400 to-cyan-600',   'The original launch series.'),
    ],
    holyGrailLabel: 'Ultimate Alternate Arts',
    holyGrailDesc:  'The most prized Digimon singles on CardPop — Alternate Art champions and graded gems.',
  },

  // ── Final Fantasy ─────────────────────────────────────────────────────────
  'final-fantasy': {
    slug: 'final-fantasy',
    name: 'Final Fantasy',
    categoryAliases: ['Final Fantasy', 'FFTCG'],
    tagline: 'Embrace Your Fate — Collect the Legend',
    seoTitle: 'Final Fantasy TCG Australia | CardPop',
    seoDescription: 'Buy and sell Final Fantasy TCG singles from verified Australian collectors.',
    seoIntro: 'The Final Fantasy Trading Card Game combines stunning artwork from the beloved game franchise with deep strategic gameplay. Iconic characters like Cloud, Lightning, Terra and Sephiroth shine as chase cards.',
    heroGradient: 'from-sky-500 via-blue-500 to-indigo-600',
    heroTextDark: false,
    accentHex: '#3B82F6',
    badgeGradient: 'from-sky-500 to-blue-700',
    Icon: CrystalIcon,
    eras: [
      era('Emissaries of Light', '2024–Now',  'from-amber-300 to-yellow-500', 'Latest opus.'),
      era('Beyond Destiny',      '2023',      'from-purple-500 to-violet-700', 'Fan-favourite crystal set.'),
      era('Opus I',              '2016–2017', 'from-blue-600 to-indigo-700',   'Original launch — most vintage pieces.'),
    ],
    holyGrailLabel: 'Legendary Crystals',
    holyGrailDesc:  'The most iconic Final Fantasy TCG cards on CardPop — full arts, foils, and rare opus pieces.',
  },

  // ── Riftbound ─────────────────────────────────────────────────────────────
  riftbound: {
    slug: 'riftbound',
    name: 'Riftbound',
    categoryAliases: ['Riftbound'],
    tagline: 'Tear Through the Rift — Build Your Deck',
    seoTitle: 'Riftbound Cards Australia | CardPop',
    seoDescription: 'Buy and sell Riftbound singles from verified Australian collectors.',
    seoIntro: 'Riftbound is one of the exciting new entries in the TCG space, bringing dimensional rift mechanics to competitive and casual play. Get in early and start building your collection.',
    heroGradient: 'from-violet-600 via-purple-500 to-violet-800',
    heroTextDark: false,
    accentHex: '#7C3AED',
    badgeGradient: 'from-violet-600 to-purple-800',
    Icon: RiftPortalIcon,
    eras: [
      era('Core Set', '2024–Now', 'from-violet-500 to-purple-700', 'The founding set.'),
    ],
    holyGrailLabel: 'Dimensional Rarities',
    holyGrailDesc:  'The rarest Riftbound cards on CardPop.',
  },

  // ── TMNT ──────────────────────────────────────────────────────────────────
  tmnt: {
    slug: 'tmnt',
    name: 'TMNT',
    categoryAliases: ['TMNT', 'Teenage Mutant Ninja Turtles'],
    tagline: 'Cowabunga — Collect the Turtle Power',
    seoTitle: 'TMNT Cards Australia | CardPop',
    seoDescription: 'Buy and sell Teenage Mutant Ninja Turtles card game singles from verified Australian collectors.',
    seoIntro: 'Heroes in a half shell — the TMNT card game brings Leonardo, Donatello, Michelangelo and Raphael to the tabletop in spectacular style.',
    heroGradient: 'from-green-500 via-green-400 to-emerald-500',
    heroTextDark: false,
    accentHex: '#10B981',
    badgeGradient: 'from-green-500 to-green-700',
    Icon: TurtleShellIcon,
    eras: [
      era('Core Set', '2024–Now', 'from-green-500 to-emerald-700', 'Original release.'),
    ],
    holyGrailLabel: 'Shell-Shocked Rarities',
    holyGrailDesc:  'The rarest TMNT singles on CardPop.',
  },

  // ── NBA ───────────────────────────────────────────────────────────────────
  nba: {
    slug: 'nba',
    name: 'NBA Cards',
    categoryAliases: ['NBA', 'NBA Cards', 'Basketball'],
    tagline: 'Own a Piece of Basketball History',
    seoTitle: 'NBA Basketball Cards Australia | CardPop',
    seoDescription: 'Buy and sell NBA basketball cards from verified Australian sellers. Browse Panini Prizm, Topps Chrome, and rookie auto slabs — priced in AUD.',
    seoIntro: 'Australian NBA fans are among the world\'s most passionate — and our love of collecting Luka, Wembanyama, and LeBron rookie cards is no different. CardPop connects Australian NBA card collectors with verified sellers for Panini Prizm parallels, National Treasures patches, and PSA-graded slabs across every generation of the game.',
    heroGradient: 'from-blue-700 via-blue-600 to-red-700',
    heroTextDark: false,
    accentHex: '#1D428A',
    badgeGradient: 'from-blue-700 to-red-600',
    Icon: CourtBallIcon,
    eras: [
      era('Panini Prizm',          'Current',   'from-blue-500 to-indigo-600',  'The most popular modern basketball release.'),
      era('National Treasures',    'Current',   'from-yellow-500 to-amber-600', 'Ultra-premium patches and auto cards.'),
      era('Select',                'Current',   'from-purple-500 to-violet-600','Concourse, Premier & Courtside tiers.'),
      era('Donruss Optic',         'Current',   'from-red-500 to-rose-600',     'Premium refractor parallels.'),
      era('Topps Chrome',          'Vintage',   'from-gray-500 to-slate-700',   'Pre-Panini era — 1990s chrome legends.'),
      era('Fleer / Upper Deck',    '1986–2007', 'from-stone-500 to-amber-700',  'Vintage wax era — Jordan, Bird, Magic.'),
    ],
    holyGrailLabel: 'All-Star Slabs',
    holyGrailDesc:  'CardPop\'s finest NBA cards — PSA-graded rookies, patch autos, and iconic vintage pieces.',
  },

  // ── NBL ───────────────────────────────────────────────────────────────────
  nbl: {
    slug: 'nbl',
    name: 'NBL Cards',
    categoryAliases: ['NBL', 'NBL Cards', 'National Basketball League'],
    tagline: 'Support Local — Collect Australian Basketball',
    seoTitle: 'NBL Basketball Cards Australia | CardPop',
    seoDescription: 'Buy and sell NBL National Basketball League cards from verified Australian collectors.',
    seoIntro: 'The National Basketball League is Australia\'s premier professional basketball competition and the NBL card market is growing fast. Collect your favourite Boomers, Breakers, Kings and Hawks players.',
    heroGradient: 'from-green-600 via-teal-500 to-emerald-600',
    heroTextDark: false,
    accentHex: '#059669',
    badgeGradient: 'from-green-600 to-teal-600',
    Icon: NBLBallIcon,
    eras: [
      era('TLA Authentics', '2022–Now',  'from-green-500 to-teal-600',  'Current official licensee.'),
      era('Futera',         '1990s–2000s', 'from-stone-500 to-green-700', 'Vintage Australian releases.'),
    ],
    holyGrailLabel: 'Boomers\' Best',
    holyGrailDesc:  'The most sought-after NBL singles on CardPop — Australian basketball at its finest.',
  },

  // ── AFL ───────────────────────────────────────────────────────────────────
  afl: {
    slug: 'afl',
    name: 'AFL Cards',
    categoryAliases: ['AFL', 'AFL Cards', 'Australian Football'],
    tagline: 'The Greatest Game on Earth — Collect It',
    seoTitle: 'AFL Football Cards Australia | CardPop',
    seoDescription: 'Buy and sell AFL football cards from verified Australian collectors. Browse Select AFL Footy Cards, Teamcoach, and vintage releases in AUD.',
    seoIntro: 'Australian Rules Football is part of our national identity — and AFL trading cards have been treasured by fans since the 1960s. From vintage Scanlens tobacco cards to modern Select Footy Stars, Australian collectors are passionate about owning a piece of our football history. Shop verified AFL singles and sets on CardPop.',
    heroGradient: 'from-red-600 via-orange-500 to-yellow-500',
    heroTextDark: false,
    accentHex: '#DC2626',
    badgeGradient: 'from-red-600 to-yellow-500',
    Icon: AFLBallIcon,
    eras: [
      era('Select Footy Stars', '2024',      'from-blue-500 to-indigo-600',  'Current flagship release.'),
      era('Select Optimum',     '2020–2023', 'from-purple-500 to-violet-600','Premium refractor parallels.'),
      era('Select AFL',         '2000–2019', 'from-green-500 to-teal-600',   'Core annual set era.'),
      era('Teamcoach',          '1990s–Now', 'from-red-500 to-orange-600',   'Strategy card game series.'),
      era('Scanlens / Stimorol','1960s–1990s','from-stone-500 to-amber-700', 'Vintage — most valuable AFL cards.'),
    ],
    holyGrailLabel: 'Brownlow Medal Pieces',
    holyGrailDesc:  'The finest AFL cards on CardPop — vintage Scanlens, premium auto patches, and iconic player cards.',
  },

  // ── NRL ───────────────────────────────────────────────────────────────────
  nrl: {
    slug: 'nrl',
    name: 'NRL Cards',
    categoryAliases: ['NRL', 'NRL Cards', 'Rugby League'],
    tagline: 'Play Hard, Collect Harder',
    seoTitle: 'NRL Rugby League Cards Australia | CardPop',
    seoDescription: 'Buy and sell NRL National Rugby League cards from verified Australian collectors.',
    seoIntro: 'Rugby League is embedded in the culture of New South Wales and Queensland — and NRL trading cards have been a staple of Aussie childhood since the Select era. Browse vintage and modern NRL singles.',
    heroGradient: 'from-sky-600 via-blue-600 to-blue-800',
    heroTextDark: false,
    accentHex: '#0284C7',
    badgeGradient: 'from-sky-600 to-blue-800',
    Icon: RugbyBallIcon,
    eras: [
      era('Select NRL',   '2024',      'from-blue-500 to-indigo-600',  'Current official release.'),
      era('Traders',      '2000–2023', 'from-sky-400 to-blue-600',     'Long-running annual series.'),
      era('Scanlens',     '1960s–1980s','from-stone-500 to-amber-700', 'Vintage — most collectible NRL cards.'),
    ],
    holyGrailLabel: 'State of Origin Gems',
    holyGrailDesc:  'The finest NRL cards on CardPop — vintage Scanlens, auto patches, and iconic State of Origin pieces.',
  },

  // ── Cricket ───────────────────────────────────────────────────────────────
  cricket: {
    slug: 'cricket',
    name: 'Cricket Cards',
    categoryAliases: ['Cricket', 'Cricket Cards'],
    tagline: 'Collect the Ashes, Own the Legacy',
    seoTitle: 'Cricket Cards Australia | CardPop',
    seoDescription: 'Buy and sell cricket trading cards from verified Australian collectors. Browse vintage Bradman pieces and modern Topps Chrome cricket in AUD.',
    seoIntro: 'Cricket is Australia\'s summer game and cricket trading cards carry a rich history — from vintage 1930s tobacco cards of Don Bradman to the modern Topps Chrome Cricket era. Australian collectors love the history, the legends, and the thrill of the chase.',
    heroGradient: 'from-lime-500 via-green-400 to-lime-600',
    heroTextDark: true,
    accentHex: '#65A30D',
    badgeGradient: 'from-lime-500 to-green-700',
    Icon: CricketIcon,
    eras: [
      era('Topps Chrome Cricket', '2021–Now',  'from-blue-500 to-indigo-600',  'Modern refractor era.'),
      era('CA Authentics',        '2010–2020', 'from-green-500 to-teal-600',   'Official Australian releases.'),
      era('Vintage Cricket',      '1930s–1990s','from-stone-500 to-amber-700', 'Tobacco cards, Scanlens & more.'),
    ],
    holyGrailLabel: 'Ashes Legends',
    holyGrailDesc:  'The finest cricket cards on CardPop — from Bradman-era tobacco cards to modern Chrome rookies.',
  },

  // ── NFL ───────────────────────────────────────────────────────────────────
  nfl: {
    slug: 'nfl',
    name: 'NFL Cards',
    categoryAliases: ['NFL', 'NFL Cards', 'American Football'],
    tagline: 'Own a Piece of Gridiron Greatness',
    seoTitle: 'NFL Football Cards Australia | CardPop',
    seoDescription: 'Buy and sell NFL football cards from verified Australian collectors. Browse Panini Prizm, National Treasures, and Patrick Mahomes rookies in AUD.',
    seoIntro: 'NFL cards have exploded in Australia over the past decade — driven by the global rise of the game and the chase for rookie autos from the next generation of gridiron greats.',
    heroGradient: 'from-blue-800 via-blue-700 to-indigo-800',
    heroTextDark: false,
    accentHex: '#1E40AF',
    badgeGradient: 'from-blue-800 to-indigo-600',
    Icon: AmericanFootballIcon,
    eras: [
      era('Panini Prizm',       'Current',   'from-blue-500 to-indigo-600',  'The king of football cards.'),
      era('National Treasures', 'Current',   'from-yellow-500 to-amber-600', 'Patch autos of legends.'),
      era('Topps Chrome',       'Vintage',   'from-gray-500 to-slate-700',   'Classic chrome era.'),
    ],
    holyGrailLabel: 'Gridiron Greats',
    holyGrailDesc:  'The finest NFL singles on CardPop — rookie autos, 1/1 patch cards, and PSA-graded legends.',
  },

  // ── MLB ───────────────────────────────────────────────────────────────────
  mlb: {
    slug: 'mlb',
    name: 'MLB',
    categoryAliases: ['MLB', 'Baseball', 'Baseball Cards'],
    tagline: 'America\'s Pastime — Collect the Icons',
    seoTitle: 'MLB Cards Australia | CardPop',
    seoDescription: 'Buy and sell MLB cards from verified Australian collectors. Browse Topps Chrome, Bowman Chrome prospects, and vintage T206 pieces.',
    seoIntro: 'MLB cards are one of the most storied collecting hobbies in the world, with a history stretching back over 100 years. Australian collectors have a growing passion for the hobby — from vintage Honus Wagner reprints to modern Shohei Ohtani rookies.',
    heroGradient: 'from-red-500 via-red-400 to-slate-600',
    heroTextDark: false,
    accentHex: '#EF4444',
    badgeGradient: 'from-red-500 to-slate-700',
    Icon: BaseballIcon,
    eras: [
      era('Topps Chrome',     'Current',   'from-blue-500 to-indigo-600',  'Modern flagship chromium.'),
      era('Bowman Chrome',    'Current',   'from-green-500 to-teal-600',   'Prospect auto chase cards.'),
      era('Topps Heritage',   'Current',   'from-stone-400 to-amber-600',  'Retro-design annual set.'),
      era('Vintage (Pre-1980)','1900–1980','from-stone-500 to-amber-700',  'T206, T205 & classic wax.'),
    ],
    holyGrailLabel: 'Hall of Fame Hits',
    holyGrailDesc:  'The finest MLB cards on CardPop — rookie autos, vintage gems, and PSA-graded legends.',
  },

  // ── Soccer ────────────────────────────────────────────────────────────────
  soccer: {
    slug: 'soccer',
    name: 'Soccer Cards',
    categoryAliases: ['Soccer', 'Soccer Cards', 'Football Cards'],
    tagline: 'The Beautiful Game — Collect the Best',
    seoTitle: 'Soccer Football Cards Australia | CardPop',
    seoDescription: 'Buy and sell soccer football cards from verified Australian collectors. Browse Topps Chrome UEFA, Panini Prizm FIFA and Matildas cards.',
    seoIntro: 'Soccer card collecting has surged in Australia thanks to the success of our national teams and the global popularity of the Premier League and Champions League. From vintage Merlin stickers to modern Topps Chrome refractors, find your football cards on CardPop.',
    heroGradient: 'from-emerald-500 via-green-500 to-emerald-700',
    heroTextDark: false,
    accentHex: '#059669',
    badgeGradient: 'from-emerald-500 to-green-700',
    Icon: SoccerBallIcon,
    eras: [
      era('Topps Chrome UEFA',  'Current',   'from-blue-500 to-indigo-600',  'Champions League chromium.'),
      era('Panini Prizm FIFA',  'Current',   'from-red-500 to-orange-600',   'World Cup autograph chase.'),
      era('Topps Match Attax',  'Current',   'from-green-500 to-teal-600',   'EPL & European card game.'),
      era('Panini Stickers',    'Classic',   'from-yellow-400 to-amber-600', 'World Cup sticker albums.'),
    ],
    holyGrailLabel: 'Golden Boot Picks',
    holyGrailDesc:  'The finest soccer cards on CardPop — autographed rookies, PSA-graded legends, and rare parallels.',
  },

  // ── Formula 1 ─────────────────────────────────────────────────────────────
  'formula-1': {
    slug: 'formula-1',
    name: 'Formula 1 Cards',
    categoryAliases: ['Formula 1', 'F1', 'Formula One', 'F1 Cards'],
    tagline: 'Zero to Rare in Record Time',
    seoTitle: 'Formula 1 Cards Australia | CardPop',
    seoDescription: 'Buy and sell Formula 1 trading cards from verified Australian collectors. Browse Topps Chrome F1, Turbo Attax, and autograph cards.',
    seoIntro: 'Formula 1 has found a massive new audience in Australia and around the world, and the trading card hobby has followed. From Lewis Hamilton rookie autos to Max Verstappen limited parallels, CardPop is your pit stop for F1 card collecting.',
    heroGradient: 'from-gray-700 via-gray-600 to-red-700',
    heroTextDark: false,
    accentHex: '#DC2626',
    badgeGradient: 'from-gray-700 to-red-700',
    Icon: CheckeredFlagIcon,
    eras: [
      era('Topps Chrome F1',  'Current',   'from-gray-600 to-slate-700',   'Premium refractor releases.'),
      era('Turbo Attax',      'Current',   'from-red-500 to-orange-600',   'Starter-friendly card game.'),
      era('Topps F1 Dynasty', 'Current',   'from-yellow-400 to-amber-500', 'Historical legend cards.'),
    ],
    holyGrailLabel: 'Pole Position Picks',
    holyGrailDesc:  'The rarest F1 cards on CardPop — championship driver autos, 1/1 patch cards, and precious metals.',
  },

  // ── Tennis ────────────────────────────────────────────────────────────────
  tennis: {
    slug: 'tennis',
    name: 'Tennis Cards',
    categoryAliases: ['Tennis', 'Tennis Cards'],
    tagline: 'Ace Your Collection',
    seoTitle: 'Tennis Cards Australia | CardPop',
    seoDescription: 'Buy and sell tennis trading cards from verified Australian collectors.',
    seoIntro: 'Tennis is part of Australia\'s DNA — and trading cards of Lleyton Hewitt, Ash Barty, Nick Kyrgios and the world\'s greatest players are highly collectible. Find rare auto cards and graded slabs on CardPop.',
    heroGradient: 'from-lime-400 via-yellow-400 to-lime-500',
    heroTextDark: true,
    accentHex: '#84CC16',
    badgeGradient: 'from-lime-400 to-yellow-500',
    Icon: TennisBallIcon,
    eras: [
      era('Netpro',         '2003',      'from-blue-500 to-indigo-600', 'Classic tennis card set.'),
      era('ACE Authentic',  '2009–Now',  'from-green-500 to-teal-600',  'Premium autograph releases.'),
    ],
    holyGrailLabel: 'Grand Slam Gems',
    holyGrailDesc:  'The finest tennis cards on CardPop — player autos, rare parallels, and PSA-graded legends.',
  },

  // ── Golf ──────────────────────────────────────────────────────────────────
  golf: {
    slug: 'golf',
    name: 'Golf Cards',
    categoryAliases: ['Golf', 'Golf Cards'],
    tagline: 'Play the Long Game — Collect the Legends',
    seoTitle: 'Golf Cards Australia | CardPop',
    seoDescription: 'Buy and sell golf trading cards from verified Australian collectors. Browse Tiger Woods, Greg Norman, and modern PGA Tour autos.',
    seoIntro: 'Golf cards have surged in popularity driven by the tiger effect and a new generation of collectors chasing early Tiger Woods rookie cards. Australian golf legends like Greg Norman are also highly sought after.',
    heroGradient: 'from-green-400 via-lime-400 to-green-500',
    heroTextDark: true,
    accentHex: '#22C55E',
    badgeGradient: 'from-green-400 to-lime-500',
    Icon: GolfIcon,
    eras: [
      era('Upper Deck Golf',   '1991–Now',  'from-blue-500 to-indigo-600',  'Classic golf card releases.'),
      era('SP Authentic',      'Current',   'from-yellow-400 to-amber-500', 'Premium auto cards.'),
    ],
    holyGrailLabel: 'Major Championship Picks',
    holyGrailDesc:  'The finest golf cards on CardPop — Tiger rookie autos, Greg Norman gems, and rare parallels.',
  },

  // ── Wrestling ─────────────────────────────────────────────────────────────
  wrestling: {
    slug: 'wrestling',
    name: 'Wrestling Cards',
    categoryAliases: ['Wrestling', 'WWE', 'Wrestling Cards'],
    tagline: 'The Card Game of Champions',
    seoTitle: 'Wrestling Cards Australia | CardPop',
    seoDescription: 'Buy and sell wrestling trading cards from verified Australian collectors. Browse WWE Prizm, Topps Chrome WWE, and vintage Hasbro releases.',
    seoIntro: 'Wrestling card collecting combines nostalgia and modern hobby excitement. From vintage Hasbro figures and cards of Hulk Hogan to modern WWE Prizm autos of Roman Reigns and Cody Rhodes, Australian collectors are passionate about the sport of kings.',
    heroGradient: 'from-yellow-500 via-orange-500 to-orange-600',
    heroTextDark: false,
    accentHex: '#F97316',
    badgeGradient: 'from-yellow-500 to-orange-600',
    Icon: ChampionBeltIcon,
    eras: [
      era('Panini Prizm WWE', 'Current',   'from-blue-500 to-indigo-600',  'Modern premium wrestling cards.'),
      era('Topps Chrome WWE', 'Current',   'from-gray-600 to-slate-700',   'Chrome refractor era.'),
      era('Vintage WWE/WWF',  '1985–2005', 'from-stone-500 to-amber-700',  'Golden era — Hogan, Undertaker, Rock.'),
    ],
    holyGrailLabel: 'Championship Belt Pieces',
    holyGrailDesc:  'The finest wrestling cards on CardPop — title-holder autos, relic patch cards, and vintage gems.',
  },

  // ── UFC ───────────────────────────────────────────────────────────────────
  ufc: {
    slug: 'ufc',
    name: 'UFC Cards',
    categoryAliases: ['UFC', 'UFC Cards', 'MMA'],
    tagline: 'Train Hard, Collect Harder',
    seoTitle: 'UFC MMA Cards Australia | CardPop',
    seoDescription: 'Buy and sell UFC MMA trading cards from verified Australian collectors. Browse Panini Prizm UFC, Topps Chrome UFC, and fighter autos.',
    seoIntro: 'UFC and MMA cards are one of the fastest-growing areas of the sports card hobby. Australia has produced some legendary fighters and Australian collectors are passionate about the sport. Browse fighter autographs, patch cards, and rare parallels on CardPop.',
    heroGradient: 'from-gray-700 via-gray-600 to-red-800',
    heroTextDark: false,
    accentHex: '#DC2626',
    badgeGradient: 'from-gray-700 to-red-800',
    Icon: OctagonIcon,
    eras: [
      era('Panini Prizm UFC', 'Current',   'from-blue-500 to-indigo-600', 'Modern premium UFC releases.'),
      era('Topps Chrome UFC', 'Current',   'from-gray-600 to-slate-700',  'Chrome refractor fighter cards.'),
    ],
    holyGrailLabel: 'Octagon Elite Picks',
    holyGrailDesc:  'The rarest UFC cards on CardPop — champion autos, 1/1 patch cards, and rare parallels.',
  },

  // ── NHL ───────────────────────────────────────────────────────────────────
  nhl: {
    slug: 'nhl',
    name: 'NHL Cards',
    categoryAliases: ['NHL', 'NHL Cards', 'Ice Hockey'],
    tagline: 'Ice Cold Cards — Fire Hot Pulls',
    seoTitle: 'NHL Ice Hockey Cards Australia | CardPop',
    seoDescription: 'Buy and sell NHL ice hockey cards from verified Australian collectors. Browse Upper Deck Series, Parkhurst, and Connor McDavid autos.',
    seoIntro: 'Ice hockey card collecting has a devoted following in Australia. From vintage Parkhurst cards of Bobby Orr and Wayne Gretzky to modern Upper Deck Series One and Connor McDavid rookie patches, the NHL hobby is deep and passionate.',
    heroGradient: 'from-slate-700 via-blue-700 to-slate-900',
    heroTextDark: false,
    accentHex: '#1E40AF',
    badgeGradient: 'from-slate-700 to-blue-900',
    Icon: HockeyIcon,
    eras: [
      era('Upper Deck Series', 'Current',   'from-blue-500 to-indigo-600',  'Annual flagship release.'),
      era('The Cup',           'Current',   'from-yellow-400 to-amber-500', 'Ultra-premium patch autos.'),
      era('Parkhurst',         '1951–2005', 'from-stone-500 to-amber-700',  'Classic hockey card heritage.'),
    ],
    holyGrailLabel: 'Stanley Cup Rarities',
    holyGrailDesc:  'The finest NHL cards on CardPop — Gretzky vintage, McDavid rookies, and The Cup patch autos.',
  },
};

// Slug normaliser — handles URL variations
export const resolveCollectionSlug = (rawSlug) => {
  if (!rawSlug) return null;
  const s = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (COLLECTION_CONFIGS[s]) return s;
  // Try alias matching
  for (const [key, cfg] of Object.entries(COLLECTION_CONFIGS)) {
    if (cfg.categoryAliases?.some(a => a.toLowerCase() === rawSlug.toLowerCase())) return key;
  }
  return null;
};
