/**
 * Per-product SEO copy for the Palms Off Gaming catalogue, keyed by line SKU.
 *
 * Hand-written, and deliberately separate from data/palmsOffCatalogue.js: that
 * file is GENERATED from the Storage bucket and can be regenerated whenever the
 * bucket changes, which would wipe any copy written into it. Keeping the words
 * here means regeneration only ever touches titles, SKUs, colours and image
 * paths.
 *
 * These override the product type's shared copy (data/palmsOffCategories.js) on
 * a product's own page. The type-level copy remains the fallback and still
 * supplies the FAQs, which are genuinely shared: "what does pt mean" has one
 * answer for every top loader on the site.
 *
 * Rule followed throughout: say only what the SKU, the product name, the
 * product type and the photography actually establish. No invented dimensions,
 * capacities, pack counts or materials. Where a product's distinguishing
 * feature is a number already in its name — a point rating, a size, a pack
 * count — that number is the subject of the copy, because it is what a buyer
 * is choosing on and what makes each page genuinely different from its
 * siblings rather than a reworded duplicate.
 *
 * Keep dependency-free: api/prerender.js imports this via the catalogue.
 */

export const PALMS_OFF_PRODUCT_COPY = {
  // ── Premium Sleeves ───────────────────────────────────────────────────────
  'BODS-ST': {
    metaDescription: 'Blackout deck sleeves in standard size from Palms Off Gaming — opaque backs, 14 colours. For Pokémon, Magic, One Piece, Lorcana and sports cards.',
    intro: 'The standard-size Blackout sleeve is the everyday sleeve for English Pokémon, Magic, One Piece, Lorcana and sports cards. The back is fully opaque, which is the property that matters in play: nothing shows through, so no sleeve in the deck can be identified from the back as it wears. Fourteen colours, so a collection or a playgroup can be colour-coded rather than guessed at.',
    highlights: ['Standard size — fits Pokémon, Magic, One Piece, Lorcana and sports cards', 'Fully opaque back so no sleeve is identifiable from behind', 'Gloss finish — faster shuffling, stronger colour', 'Available in 14 colours'],
  },
  'BODS-ST-M': {
    metaDescription: 'Matte blackout deck sleeves in standard size from Palms Off Gaming — opaque backs, reduced glare, 14 colours. For Pokémon, Magic, One Piece and sports cards.',
    intro: 'The matte version of the standard Blackout sleeve. Same opaque back and same size, with a textured finish that kills glare under bright light and adds a little grip — the reason most players who sleeve a deck for long sessions or photograph their cards choose matte over gloss. Fourteen colours.',
    highlights: ['Standard size — fits Pokémon, Magic, One Piece, Lorcana and sports cards', 'Matte finish reduces glare and photographs cleanly', 'Fully opaque back so no sleeve is identifiable from behind', 'Available in 14 colours'],
  },
  'BODS-JPN': {
    metaDescription: 'Blackout deck sleeves in Japanese mini size from Palms Off Gaming — opaque backs, 14 colours. Sized for Japanese Pokémon and Yu-Gi-Oh cards.',
    intro: 'Japanese mini cards are meaningfully smaller than standard trading cards, and a standard sleeve leaves them loose enough to shift and catch. This is the Blackout sleeve cut to that smaller size, for Japanese Pokémon and Yu-Gi-Oh — opaque back, gloss finish, fourteen colours.',
    highlights: ['Japanese mini size — for Japanese Pokémon and Yu-Gi-Oh', 'Fully opaque back so no sleeve is identifiable from behind', 'Gloss finish — faster shuffling, stronger colour', 'Available in 14 colours'],
  },
  'BODS-JPN-M': {
    metaDescription: 'Matte blackout deck sleeves in Japanese mini size from Palms Off Gaming — opaque backs, reduced glare, 14 colours. For Japanese Pokémon and Yu-Gi-Oh.',
    intro: 'The matte Blackout sleeve in Japanese mini size, for Japanese Pokémon and Yu-Gi-Oh. The textured finish cuts glare and adds grip, which matters more in mini size than standard — smaller cards are fiddlier to separate, and a matte surface gives your fingers something to work with.',
    highlights: ['Japanese mini size — for Japanese Pokémon and Yu-Gi-Oh', 'Matte finish reduces glare and adds grip', 'Fully opaque back so no sleeve is identifiable from behind', 'Available in 14 colours'],
  },
  'PROS-ST-CLR': {
    metaDescription: 'Clear premium over sleeves in standard size from Palms Off Gaming — the outer half of a double-sleeve, so the inner sleeve is never handled.',
    intro: 'An over sleeve is the outer half of a double-sleeve: the card goes into an inner sleeve first, then the whole thing goes into this. The card is then sealed on every side, and every bit of shuffling, handling and table contact lands on a sleeve you can replace for cents. Clear, so the card and its inner sleeve show through unchanged.',
    highlights: ['Standard size, for double-sleeving over an inner sleeve', 'Clear — the card shows through with no tint', 'Seals the card on all sides when paired with an inner sleeve', 'All handling wear lands on the outer sleeve'],
  },
  'PROS-ST-MAT': {
    metaDescription: 'Matte premium over sleeves in standard size from Palms Off Gaming — the outer half of a double-sleeve, with a glare-free finish.',
    intro: 'The matte over sleeve does the same job as the clear one — outer half of a double-sleeve, taking all the handling so the inner sleeve and the card take none — with a textured finish instead of a glossy one. Worth choosing if the deck gets played under bright light, or if the cards get photographed.',
    highlights: ['Standard size, for double-sleeving over an inner sleeve', 'Matte finish reduces glare in play and in photos', 'Seals the card on all sides when paired with an inner sleeve', 'All handling wear lands on the outer sleeve'],
  },
  'PROS-JPN-CLR': {
    metaDescription: 'Clear premium over sleeves in Japanese mini size from Palms Off Gaming — the outer half of a double-sleeve for Japanese Pokémon and Yu-Gi-Oh.',
    intro: 'The clear over sleeve in Japanese mini size, for double-sleeving Japanese Pokémon and Yu-Gi-Oh. Card into an inner sleeve, inner sleeve into this — the card ends up sealed on all sides, and nothing that happens at the table touches it directly.',
    highlights: ['Japanese mini size, for double-sleeving over an inner sleeve', 'Clear — the card shows through with no tint', 'Seals the card on all sides when paired with an inner sleeve', 'All handling wear lands on the outer sleeve'],
  },
  'PROS-JPN-MAT': {
    metaDescription: 'Matte premium over sleeves in Japanese mini size from Palms Off Gaming — glare-free outer sleeves for double-sleeved Japanese Pokémon and Yu-Gi-Oh.',
    intro: 'The matte over sleeve in Japanese mini size. Outer half of a double-sleeve for Japanese Pokémon and Yu-Gi-Oh, finished matte so it does not glare under lights and gives a little more grip on a small card.',
    highlights: ['Japanese mini size, for double-sleeving over an inner sleeve', 'Matte finish reduces glare and adds grip', 'Seals the card on all sides when paired with an inner sleeve', 'All handling wear lands on the outer sleeve'],
  },

  // ── Top Loaders ───────────────────────────────────────────────────────────
  'TL-35PT': {
    metaDescription: '35pt rigid top loaders from Palms Off Gaming — the standard size for modern trading cards. For posting, trading and everyday protection.',
    intro: '35pt is the thickness of an ordinary modern trading card, which makes this the top loader almost everything you pull will need. It is the default for posting a card, for handing one across a table, and for anything sitting in a box waiting to be sorted. If you buy one point size in bulk, this is it.',
    highlights: ['35pt — fits standard modern trading cards', 'The size almost every modern single needs', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'TL-55PT': {
    metaDescription: '55pt rigid top loaders from Palms Off Gaming — for thicker-stock cards that will not fit a standard 35pt loader.',
    intro: 'The first step up from standard. 55pt takes cards that are noticeably thicker than a normal single — heavier stock inserts, some older cards, and thinner relic cards — where a 35pt loader will not close properly. If a card is a struggle to get into a 35pt, this is the size it wants.',
    highlights: ['55pt — for cards thicker than a standard modern single', 'Thicker-stock inserts and heavier older cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'TL-75PT': {
    metaDescription: '75pt rigid top loaders from Palms Off Gaming — for thick relic, jersey and patch cards.',
    intro: '75pt is squarely in relic territory: jersey swatches, single-piece patches and the heavier premium inserts that have real depth to them. A card at this thickness in a smaller loader will bow the plastic; in a larger one it will rattle.',
    highlights: ['75pt — for jersey, relic and thick premium inserts', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'TL-100PT': {
    metaDescription: '100pt rigid top loaders from Palms Off Gaming — for heavy patch and multi-piece relic cards.',
    intro: '100pt handles the cards that are closer to an object than a piece of card — multi-piece patches, thick memorabilia inserts, and anything with a window or embedded swatch. Getting the point size right matters most at this end of the range, because these are usually the cards worth protecting.',
    highlights: ['100pt — for heavy patch and multi-piece relic cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'TL-130PT': {
    metaDescription: '130pt rigid top loaders from Palms Off Gaming — for the thickest memorabilia and multi-swatch cards.',
    intro: '130pt is for the heavy end: multi-swatch memorabilia, booklet-style inserts and anything a 100pt loader will not close on. Rare enough that most collections need only a few, and worth having on hand before the card that needs one turns up.',
    highlights: ['130pt — for the thickest memorabilia and multi-swatch cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'TL-180PT': {
    metaDescription: '180pt rigid top loaders from Palms Off Gaming — the largest point size in the range, for the thickest cards.',
    intro: 'The largest point size Palms Off Gaming make. 180pt exists for the outliers — the thickest booklets, heavily layered memorabilia and oversized-stock cards that nothing else in the range will take. If you have a card no other loader will close on, this is the one.',
    highlights: ['180pt — the largest size in the range', 'For the thickest booklet and memorabilia cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'TL-PACK': {
    metaDescription: 'Booster pack top loaders from Palms Off Gaming — rigid protection sized for a sealed booster pack rather than a single card.',
    intro: 'Sized for a sealed booster pack, not a card. Loose packs are awkward to keep in good condition — they crease at the corners, the foil scuffs, and a bent pack is worth noticeably less than a flat one. A rigid loader keeps a pack flat and posts safely, which is the difference between selling a pack and selling a damaged one.',
    highlights: ['Sized for a sealed booster pack, not a single card', 'Keeps packs flat and stops corner creasing', 'Rigid enough to post without a bend', 'For anyone holding or reselling sealed packs'],
  },
  'CL-35PT': {
    metaDescription: '35pt card loaders from Palms Off Gaming — rigid protection for standard modern trading cards.',
    intro: 'The card loader is Palms Off Gaming\'s alternative rigid protector in the same 35pt standard size — see the product photos for the loading edge and profile, which is where it differs from a top loader. Same job: rigid protection for a standard modern card.',
    highlights: ['35pt — fits standard modern trading cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'CL-100PT': {
    metaDescription: '100pt card loaders from Palms Off Gaming — rigid protection for heavy patch and relic cards.',
    intro: 'The 100pt card loader, for heavy patch and multi-piece relic cards. Same point rating as the equivalent top loader — check the photos for the loading edge and profile, which is the difference between the two.',
    highlights: ['100pt — for heavy patch and multi-piece relic cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },
  'CL-180PT': {
    metaDescription: '180pt card loaders from Palms Off Gaming — the largest point size, for the thickest booklet and memorabilia cards.',
    intro: 'The 180pt card loader — the largest point size in the range, for booklets and heavily layered memorabilia. Check the photos for the loading edge and profile against the equivalent top loader.',
    highlights: ['180pt — the largest size in the range', 'For the thickest booklet and memorabilia cards', 'Rigid protection for posting, trading and storage', 'Use with a penny sleeve so the card never touches the PVC'],
  },

  // ── Magnetic Holders ──────────────────────────────────────────────────────
  'MAG-35PT': {
    metaDescription: '35pt mag lock card case from Palms Off Gaming — magnetic one-touch acrylic display case for standard modern cards.',
    intro: '35pt is the standard modern card thickness, which makes this the one-touch most raw cards belong in. It is the step up from a top loader for a card you actually want to look at: clear on both faces, rigid, and it opens without tools when you need it to.',
    highlights: ['35pt — fits standard modern trading cards', 'Magnetic closure holds the card without pressure or adhesive', 'Clear on both faces for display', 'Opens without tools'],
  },
  'MAG-55PT': {
    metaDescription: '55pt mag lock card case from Palms Off Gaming — magnetic one-touch acrylic case for thicker-stock cards.',
    intro: 'The 55pt one-touch, for cards a little thicker than a standard single — heavier stock inserts and thinner relics. Getting the point size right matters here: a card that rattles inside an oversized case picks up exactly the edge wear the case was bought to prevent.',
    highlights: ['55pt — for cards thicker than a standard modern single', 'Magnetic closure holds the card without pressure or adhesive', 'Clear on both faces for display', 'Opens without tools'],
  },
  'MAG-75PT': {
    metaDescription: '75pt mag lock card case from Palms Off Gaming — magnetic one-touch acrylic case for jersey and relic cards.',
    intro: 'The 75pt one-touch, sized for jersey swatches, single-piece patches and thicker premium inserts. These are cards where the insert itself is part of the appeal, so a case that shows both faces cleanly is doing more work than a loader.',
    highlights: ['75pt — for jersey, relic and thick premium inserts', 'Magnetic closure holds the card without pressure or adhesive', 'Clear on both faces for display', 'Opens without tools'],
  },
  'MAG-100PT': {
    metaDescription: '100pt mag lock card case from Palms Off Gaming — magnetic one-touch acrylic case for heavy patch and relic cards.',
    intro: 'The 100pt one-touch, for multi-piece patches and thick memorabilia. At this thickness a card is usually one of the better things in a collection, and a rigid magnetic case is the normal way to keep it displayable without anyone needing to handle it.',
    highlights: ['100pt — for heavy patch and multi-piece relic cards', 'Magnetic closure holds the card without pressure or adhesive', 'Clear on both faces for display', 'Opens without tools'],
  },
  'MAG-130PT': {
    metaDescription: '130pt mag lock card case from Palms Off Gaming — magnetic one-touch acrylic case for thick memorabilia cards.',
    intro: 'The 130pt one-touch, for multi-swatch memorabilia and booklet-style cards that a 100pt case will not close on. Uncommon enough that most collections need one or two, specific enough that nothing else fits.',
    highlights: ['130pt — for the thickest memorabilia and multi-swatch cards', 'Magnetic closure holds the card without pressure or adhesive', 'Clear on both faces for display', 'Opens without tools'],
  },
  'MAG-180PT': {
    metaDescription: '180pt mag lock card case from Palms Off Gaming — the largest one-touch in the range, for the thickest cards.',
    intro: 'The largest one-touch Palms Off Gaming make. 180pt is for the outliers — thick booklets and heavily layered memorabilia — where every smaller case is simply the wrong shape.',
    highlights: ['180pt — the largest one-touch in the range', 'For the thickest booklet and memorabilia cards', 'Magnetic closure holds the card without pressure or adhesive', 'Clear on both faces for display'],
  },

  // ── Graded Card Cases ─────────────────────────────────────────────────────
  'GCC-S': {
    metaDescription: "Collector's Series small graded card case from Palms Off Gaming — a hard carry case sized for graded slabs. Seven colours.",
    intro: 'The small case in the Collector\'s Series carry range. Sized for graded slabs and built for the trip: a handful of your best cards travelling to a show, a shop or a buyer, arriving without the corner chipping that comes from slabs stacked loose in a bag. Seven colours.',
    highlights: ['Hard carry case built around graded slab dimensions', 'The smallest of the three sizes — for a selected few slabs', 'Stops slabs knocking against each other in transit', 'Available in 7 colours'],
  },
  'GCC-M': {
    metaDescription: "Collector's Series medium graded card case from Palms Off Gaming — a hard carry case sized for graded slabs. Seven colours.",
    intro: 'The middle size in the Collector\'s Series carry range, and the one most collections settle on — enough capacity to take a proper selection to a show without carrying the whole collection. Sized around graded slabs, so nothing shifts. Seven colours.',
    highlights: ['Hard carry case built around graded slab dimensions', 'Mid-size — a proper selection rather than the whole collection', 'Stops slabs knocking against each other in transit', 'Available in 7 colours'],
  },
  'GCC-L': {
    metaDescription: "Collector's Series large graded card case from Palms Off Gaming — the highest-capacity hard carry case for graded slabs. Five colours.",
    intro: 'The largest case in the Collector\'s Series carry range, for when the whole graded collection moves at once — a table at a show, a move, or a handover. Same slab-sized fit as the smaller cases, with the most capacity of the three. Five colours.',
    highlights: ['Hard carry case built around graded slab dimensions', 'The highest capacity of the three sizes', 'Stops slabs knocking against each other in transit', 'Available in 5 colours'],
  },

  // ── Card Savers (semi-rigid grading holders) ──────────────────────────────
  'SRGH-50': {
    metaDescription: 'Semi-rigid grading holders from Palms Off Gaming, 50 pack — the holder PSA, BGS, CGC and ACE ask for on submission.',
    intro: 'Fifty semi-rigid holders — the submission pack size, for a handful of cards going off to be graded rather than a standing supply. This is the format grading companies specifically ask for: firm enough to protect in transit, flexible enough that a grader can slide the card out without cutting anything.',
    highlights: ['50 pack — sized for an occasional submission', 'The holder format PSA, BGS, CGC and ACE ask for', 'Firm in transit, but a grader can remove the card without tools', 'Check the grading company\'s current guidelines before sending'],
  },
  'SRGH-200': {
    metaDescription: 'Semi-rigid grading holders from Palms Off Gaming, 200 pack — bulk submission supply for PSA, BGS, CGC and ACE.',
    intro: 'Two hundred semi-rigid holders — the bulk pack, for anyone submitting regularly or running a store that handles other people\'s submissions. Same holder as the 50 pack, bought at the quantity that stops you running out mid-submission.',
    highlights: ['200 pack — bulk supply for regular or store-volume submissions', 'The holder format PSA, BGS, CGC and ACE ask for', 'Firm in transit, but a grader can remove the card without tools', 'Check the grading company\'s current guidelines before sending'],
  },

  // ── Graded Card Protectors (Mint Fit, holder-fitted) ──────────────────────
  'MF-PSA-REG': {
    metaDescription: 'Mint Fit PSA slab sleeves (regular) from Palms Off Gaming — sleeves cut to fit a standard PSA graded slab.',
    intro: 'A PSA slab picks up its scuffs from storage and handling, not from anything dramatic — sliding in and out of a box, rubbing against the slab next to it. These sleeves are cut to the standard PSA case, so they go on snugly rather than flapping, and the acrylic stays clean enough to photograph and resell well.',
    highlights: ['Cut to fit a standard PSA graded slab', 'Protects the case, so the case keeps protecting the card', 'Keeps acrylic clean for photography and resale', 'Choose Extra Thick if a regular sleeve will not go on'],
  },
  'MF-PSA-EX': {
    metaDescription: 'Mint Fit PSA slab sleeves (extra thick) from Palms Off Gaming — sleeves for the deeper PSA slabs that a regular sleeve will not fit.',
    intro: 'Thicker cards produce thicker slabs, and a regular sleeve will not go over them without force. This is the extra thick version, cut for those deeper PSA cases. If you have been fighting a sleeve onto a slab, this is the one you actually needed.',
    highlights: ['Cut for the deeper PSA slabs a regular sleeve will not fit', 'Protects the case, so the case keeps protecting the card', 'Keeps acrylic clean for photography and resale', 'Use the Regular version for standard-depth slabs'],
  },
  'MF-BGS-REG': {
    metaDescription: 'Mint Fit BGS slab sleeves (regular) from Palms Off Gaming — sleeves cut to fit a standard BGS graded slab.',
    intro: 'BGS cases are a different shape to PSA, so a PSA sleeve is the wrong fit. These are cut to the standard BGS slab — snug, so the case does not slide around inside and the sleeve does the job it is there for.',
    highlights: ['Cut to fit a standard BGS graded slab', 'A different shape to PSA — the fit is specific', 'Protects the case, so the case keeps protecting the card', 'Keeps acrylic clean for photography and resale'],
  },
  'MF-MAG-35': {
    metaDescription: 'Mint Fit mag lock sleeves for 35pt to 75pt cases from Palms Off Gaming — sleeves that protect the one-touch itself.',
    intro: 'A one-touch case protects the card, and then nothing protects the case. Stacked in a box or a drawer, acrylic scratches acrylic. These sleeves fit mag lock cases in the 35pt to 75pt range — the sizes most raw cards live in — so the case stays as clear as the day it closed.',
    highlights: ['Fits mag lock cases from 35pt to 75pt', 'Stops acrylic scratching acrylic in storage', 'Keeps a displayed case clear and photographable', 'Use the 100pt–130pt version for larger cases'],
  },
  'MF-MAG-130': {
    metaDescription: 'Mint Fit mag lock sleeves for 100pt to 130pt cases from Palms Off Gaming — sleeves for the larger one-touch sizes.',
    intro: 'The larger mag lock sleeve, covering cases from 100pt to 130pt — the sizes that hold patch, relic and memorabilia cards. Those are usually the cases worth keeping unscratched, since a scuffed one-touch is the first thing a buyer notices.',
    highlights: ['Fits mag lock cases from 100pt to 130pt', 'Stops acrylic scratching acrylic in storage', 'Keeps a displayed case clear and photographable', 'Use the 35pt–75pt version for smaller cases'],
  },
  'MF-TL-35PT': {
    metaDescription: 'Mint Fit top loader sleeves (35pt) from Palms Off Gaming — sleeves cut to fit a standard 35pt top loader.',
    intro: 'Cut to fit a 35pt top loader rather than a card. A loader that is sleeved does not rub against its neighbours in a box, does not pick up dust through the open top, and can be labelled without anything adhesive touching the loader itself.',
    highlights: ['Cut to fit a standard 35pt top loader', 'Covers the loader\'s open top against dust', 'Stops loaders scuffing each other in a box', 'For trade stock, storage and posting'],
  },
  'MF-TL-PACK': {
    metaDescription: 'Mint Fit booster pack top loader sleeves from Palms Off Gaming — sleeves sized for a booster pack top loader.',
    intro: 'The sleeve for a booster pack top loader — the larger loader, not the card-sized one. Sealed packs held for resale are judged on condition down to the foil, so keeping the loader clean and the pack sealed inside it is the whole point.',
    highlights: ['Sized for a booster pack top loader, not a card loader', 'Covers the loader\'s open top against dust', 'For sealed packs held or resold on condition', 'Stops loaders scuffing each other in storage'],
  },
  'MF-PACK-EX': {
    metaDescription: 'Mint Fit booster pack sleeves (extra thick) from Palms Off Gaming — heavier sleeves for sealed booster packs.',
    intro: 'A sleeve for a sealed booster pack, in the extra thick gauge. Packs are awkward things to store well: the foil scuffs, the corners crease, and both of those come off the price. A heavier sleeve takes that handling instead of the pack.',
    highlights: ['Sized for a sealed booster pack', 'Extra thick gauge for heavier handling', 'Protects foil from scuffing and corners from creasing', 'For packs held or resold on condition'],
  },

  // ── Perfect Fit Sleeves (Mint Fit inner) ─────────────────────────────────
  'MF-IN-ST': {
    metaDescription: 'Mint Fit inner sleeves in standard size from Palms Off Gaming — snug inner sleeves for double-sleeving Pokémon, Magic and sports cards.',
    intro: 'The inner half of a double-sleeve, cut close to the card so it does not shift inside — and thin enough that the whole thing still drops into a normal deck sleeve on top. Standard size, for English Pokémon, Magic, One Piece, Lorcana and sports cards.',
    highlights: ['Standard size — Pokémon, Magic, One Piece, Lorcana, sports', 'Snug fit so the card cannot shift inside the sleeve', 'Thin enough to still fit inside a normal deck sleeve', 'Load upside down relative to the outer sleeve to seal the card'],
  },
  'MF-IN-JPN': {
    metaDescription: 'Mint Fit inner sleeves in Japanese mini size from Palms Off Gaming — snug inner sleeves for double-sleeving Japanese Pokémon and Yu-Gi-Oh.',
    intro: 'The inner sleeve cut to Japanese mini size, for Japanese Pokémon and Yu-Gi-Oh. A standard inner sleeve on a mini card leaves room for the card to slide, which defeats the purpose — the fit is the entire point of an inner sleeve.',
    highlights: ['Japanese mini size — Japanese Pokémon and Yu-Gi-Oh', 'Snug fit so the card cannot shift inside the sleeve', 'Thin enough to still fit inside a normal deck sleeve', 'Load upside down relative to the outer sleeve to seal the card'],
  },
  'MF-SLIN-ST': {
    metaDescription: 'Mint Fit side-loading inner sleeves in standard size from Palms Off Gaming — the opening sits at right angles to the outer sleeve.',
    intro: 'A side-loading inner sleeve opens on the edge rather than the top. Paired with a normal top-loading outer sleeve, the two openings end up at right angles — which seals the card completely without the fiddly business of remembering to load the inner sleeve upside down. Standard size.',
    highlights: ['Standard size — Pokémon, Magic, One Piece, Lorcana, sports', 'Side opening sits at right angles to a top-loading outer sleeve', 'Seals the card without loading the inner sleeve upside down', 'Snug fit so the card cannot shift inside'],
  },
  'MF-SLIN-JPN': {
    metaDescription: 'Mint Fit side-loading inner sleeves in Japanese mini size from Palms Off Gaming — right-angle sealing for Japanese Pokémon and Yu-Gi-Oh.',
    intro: 'The side-loading inner sleeve in Japanese mini size. The side opening crosses the outer sleeve\'s top opening at right angles, sealing the card on every edge — the most reliable way to double-sleeve a mini card, where the margins are smaller and mistakes show sooner.',
    highlights: ['Japanese mini size — Japanese Pokémon and Yu-Gi-Oh', 'Side opening sits at right angles to a top-loading outer sleeve', 'Seals the card without loading the inner sleeve upside down', 'Snug fit so the card cannot shift inside'],
  },

  // ── Penny Sleeves ─────────────────────────────────────────────────────────
  'SCS-ST': {
    metaDescription: 'Soft card sleeves in standard size from Palms Off Gaming — the first layer of protection for Pokémon, Magic, One Piece and sports cards.',
    intro: 'The plain soft sleeve, standard size. It is the cheapest thing in the range and the one that prevents the most damage: a card in a soft sleeve can go into a top loader, a binder pocket or a storage box without its surface ever touching anything rigid. Buy more than you think you need.',
    highlights: ['Standard size — Pokémon, Magic, One Piece, Lorcana, sports', 'The first layer, before a loader, binder or box', 'Stops the card face contacting rigid PVC', 'The one accessory worth buying in bulk'],
  },
  'SCS-JPN': {
    metaDescription: 'Soft card sleeves in Japanese mini size from Palms Off Gaming — first-layer protection for Japanese Pokémon and Yu-Gi-Oh cards.',
    intro: 'The plain soft sleeve cut to Japanese mini size, for Japanese Pokémon and Yu-Gi-Oh. Same job as the standard sleeve — the layer between a card face and anything rigid — sized so a mini card is actually held rather than rattling in a sleeve built for a bigger card.',
    highlights: ['Japanese mini size — Japanese Pokémon and Yu-Gi-Oh', 'The first layer, before a loader, binder or box', 'Stops the card face contacting rigid PVC', 'The one accessory worth buying in bulk'],
  },

  // ── Storage Boxes (Command Cases) ────────────────────────────────────────
  'CMD-1': {
    metaDescription: 'Palms Off Gaming Command Case — a hard case for transporting and storing cards. See the product photos for the interior layout.',
    intro: 'The Command Case is Palms Off Gaming\'s hard carry case. The product photography shows it closed, open and from both interior angles — worth looking through before buying, since the interior layout is what determines whether it suits how you carry cards.',
    highlights: ['Hard case for transport and storage', 'Photographed closed, open and from both interior angles', 'Also available as a 10 pack'],
  },
  'CMD-10': {
    metaDescription: 'Palms Off Gaming Command Case, 10 pack — bulk quantity of the hard carry case, for stores and collectors kitting out a whole collection at once.',
    intro: 'Ten Command Cases. The bulk quantity, for a store carrying them as stock or anyone kitting out a whole collection at once rather than buying a case at a time.',
    highlights: ['10 pack — bulk quantity', 'Hard case for transport and storage', 'Also available individually'],
  },

  // ── Deck Boxes ────────────────────────────────────────────────────────────
  'DB-G': {
    metaDescription: 'Genesis deck box from Palms Off Gaming — a buckle-closed deck box for sleeved decks, in seven colours.',
    intro: 'The Genesis is Palms Off Gaming\'s buckled deck box. A deck box lives in a bag and gets opened every week, so the closure is the part that decides whether it is still usable in a year — the photography shows the buckle and lid design in detail. Seven colours.',
    highlights: ['For sleeved, playable decks', 'Buckle closure — see the photos for the mechanism', 'Available in 7 colours', 'Allow extra room if your deck is double-sleeved'],
  },
  'PTL-N100': {
    metaDescription: 'Portal Deck Box Nexus 100 from Palms Off Gaming — a deck box for sleeved, playable decks, with a different closure and profile to the Genesis.',
    intro: 'The Portal Nexus 100, the second deck box design in the range. Check the product photos against the Genesis for the closure and profile — that is where the two differ, and it is the part you live with every time you open it.',
    highlights: ['For sleeved, playable decks', 'A different closure and profile to the Genesis — compare the photos', 'Allow extra room if your deck is double-sleeved'],
  },

  // ── Playmats ──────────────────────────────────────────────────────────────
  'PM-ST': {
    metaDescription: 'Palms Off Gaming playmat — rubber-backed mat for play, trading and card photography. Available in eight colours.',
    intro: 'A playmat gives sleeves a surface they can be picked up from without being dragged across bare table, and the rubber backing stops the mat itself sliding mid-game. It doubles as the best card photography surface most people own — flat, matte and a plain single colour. Eight colours.',
    highlights: ['Rubber backing keeps the mat still on the table', 'Lets you lift a sleeved card without scraping it off the table', 'A plain, flat surface for card photography', 'Available in 8 colours'],
  },

  // ── Team Bags ─────────────────────────────────────────────────────────────
  'TEAM-100': {
    metaDescription: 'Palms Off Gaming team bags — resealable outer bags sized to fit a card already in a top loader.',
    intro: 'The resealable bag that goes around a card already in a top loader. It seals the loader\'s open top, so nothing works its way loose in the post, keeps dust and moisture out, and gives you a surface to write on. It is the last step before a card goes into a mailer.',
    highlights: ['Sized to fit a standard top loader', 'Seals the loader\'s open top for posting', 'Keeps dust and moisture off the card', 'A writable surface for labelling without adhesive on the loader'],
  },

  // ── Tag Sleeves ───────────────────────────────────────────────────────────
  'TAG-100': {
    metaDescription: 'Palms Off Gaming tag sleeves — sleeves that hold a price or inventory tag alongside the card, with nothing adhesive touching it.',
    intro: 'Tag sleeves let a card carry its own label — price, condition, SKU — without a sticker ever touching the card or its holder. For anyone selling at markets or running stock through a shop, that is the difference between pricing at a glance and looking every card up.',
    highlights: ['Holds a tag alongside the card', 'Nothing adhesive touches the card or its holder', 'For market stalls, shop stock and inventory', 'Label is removable and reusable as stock changes'],
  },

  // ── Tamper Seals ──────────────────────────────────────────────────────────
  'STS-100': {
    metaDescription: 'Palms Off Gaming serialised tamper seals — numbered, tamper-evident seals on a roll for sealed product, breaks and consignment.',
    intro: 'Each seal carries its own serial number, and removing one damages it visibly. That turns "this has not been opened since I sealed it" from something a buyer has to take on trust into something they can check — and gives you a number to quote in a listing, a receipt or a dispute. Supplied on a roll.',
    highlights: ['Individually serialised — each seal has its own number', 'Tamper-evident: removal visibly destroys the seal', 'For sealed product, break streaming and consignment', 'Supplied on a roll'],
  },
};
