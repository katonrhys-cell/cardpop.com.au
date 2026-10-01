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
 * product type, the photography, or a published retailer listing for that
 * exact product establishes. Each entry's `// Source:` comments name the
 * listings its `specs` rows and figures were checked against; an entry with no
 * source keeps to title-level facts. No invented dimensions, capacities, pack
 * counts or materials.
 *
 * `details` is the long-form "About" section (product page + bot prerender)
 * and `specs` adds verified rows to palmsOffSpecs(). Where a product's distinguishing
 * feature is a number already in its name — a point rating, a size, a pack
 * count — that number is the subject of the copy, because it is what a buyer
 * is choosing on and what makes each page genuinely different from its
 * siblings rather than a reworded duplicate.
 *
 * Keep dependency-free: api/prerender.js imports this via the catalogue.
 */

export const PALMS_OFF_PRODUCT_COPY = {
  // Source: https://www.kmart.com.au/product/palms-off-gaming-blackout-deck-sleeves-100pk-standard-size-black-110128728/
  // Source: https://cardbot.com.au/products/palms-off-gaming-blackout-deck-sleeves-standard-size-100pc-rose
  // Source: https://otakumart.co.nz/products/blackout-deck-sleeves-standard-pink-palms-off
  "BODS-ST": {
    metaDescription: "Palms Off Gaming Blackout Deck Sleeves, standard size: 100 opaque-backed sleeves for Pokémon, Magic, Lorcana and One Piece decks. Stocked in Australia.",
    intro: "Blackout Deck Sleeves are Palms Off Gaming's tournament sleeve for standard-size cards. Each pack holds 100 sleeves with a clear front and a stipple-textured back that is fully opaque, built from two layers so nothing behind the card shows through. That is the sleeve to reach for when a Pokémon, Magic, Lorcana or One Piece deck is going to be shuffled hard every week and still needs to look uniform from the back.",
    details: [
      "An opaque back matters more than most players realise. Once a sleeve picks up a nick or a scuff, a see-through back can let you, or your opponent, tell one card from another. A solid back hides both the card back and most of the sleeve's own wear, which keeps a deck consistent across a long event. The textured surface also lets sleeved cards slide past each other cleanly when you riffle or mash shuffle.",
      "At 66 × 91 mm the sleeve leaves a small margin around a 63 × 88 mm card, so it works on its own or over a snug inner sleeve if you want to double-sleeve. Pair it with Mint Fit Inner Sleeves for a sealed card, or with a Palms Off deck box to carry the finished deck. A hundred sleeves covers a 60-card constructed deck with spares, or most of a 100-card Commander list.",
      "Choose this version for a standard-finish sleeve in standard size. If you play under bright venue lights or photograph your cards, the matte version (BODS-ST-M) cuts glare. If your deck is Yu-Gi-Oh!, you need the Japanese mini size instead, since these will be loose on the smaller card. The sleeves are acid-free and PVC-free, so they are fine for long-term storage as well as play.",
    ],
    highlights: [
      "100 sleeves per pack",
      "Fully opaque, stipple-textured double-layer back",
      "Clear front so the card face stays readable",
      "66 × 91 mm, for standard-size cards",
      "Acid-free and PVC-free",
      "14 colours for colour-coding decks",
    ],
    specs: [
      { label: "Fits", value: "Standard-size cards (63 × 88 mm): Pokémon (English and Japanese), Magic, One Piece, Lorcana, Dragon Ball, sports cards" },
      { label: "Pack size", value: "100 sleeves" },
      { label: "Sleeve size", value: "66 × 91 mm" },
      { label: "Back", value: "Fully opaque, stipple-textured, double-layered" },
      { label: "Front", value: "Clear" },
      { label: "Material", value: "Acid-free, PVC-free" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-blackout-deck-sleeves-100pk-standard-size-black-110128728/
  // Source: https://otakumart.co.nz/products/blackout-deck-sleeves-standard-pink-palms-off
  "BODS-ST-M": {
    metaDescription: "Palms Off Gaming Blackout Deck Sleeves, standard size, matte: opaque-backed, low-glare sleeves for Pokémon, Magic and One Piece decks in Australia.",
    intro: "This is the matte cut of Palms Off Gaming's Blackout Deck Sleeves in standard size. The opaque back is the same as the regular Blackout sleeve, but the finish is matte, so overhead lights do not bounce off the card face and the sleeves have a touch more grip in the hand. It is the version to choose for long tournament days, streamed matches or any deck you plan to photograph.",
    details: [
      "Glare is a practical problem, not a cosmetic one. Under fluorescent store lighting a glossy sleeve can wash out the text on a card across the table, and in photos it puts a white streak through the artwork. A matte surface spreads that light out, so card names, attack costs and set symbols stay readable from a seated distance. Many players also find matte sleeves easier to fan out and separate when drawing.",
      "The sleeve is cut for standard-size cards: English and Japanese Pokémon, Magic: The Gathering, One Piece, Lorcana, Dragon Ball and most sports cards. It works on its own as a single sleeve, or as the outer layer over a Mint Fit inner sleeve for a sealed double-sleeve. The opaque back means a scuffed sleeve cannot be singled out from behind, which keeps a deck tournament-legal for longer.",
      "Pick this over the standard Blackout sleeve (BODS-ST) if glare or grip has ever bothered you; pick the standard one if you prefer a slicker feel. Yu-Gi-Oh! players need the Japanese mini size. Fourteen colours let you keep one colour per deck, which makes it easy to sort a stack of sleeved cards back where they belong after a night of testing.",
    ],
    highlights: [
      "Matte finish cuts glare under venue lights",
      "Fully opaque back hides sleeve wear",
      "Standard size: Pokémon, Magic, One Piece, Lorcana, sports",
      "Works as a single sleeve or a double-sleeve outer",
      "14 colours",
    ],
    specs: [
      { label: "Fits", value: "Standard-size cards (63 × 88 mm): Pokémon (English and Japanese), Magic, One Piece, Lorcana, Dragon Ball, sports cards" },
      { label: "Finish", value: "Matte" },
      { label: "Back", value: "Opaque" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "BODS-JPN": {
    metaDescription: "Palms Off Gaming Blackout Deck Sleeves in Japanese mini size: opaque-backed deck sleeves cut for Yu-Gi-Oh! and other small cards. Sold in Australia.",
    intro: "Yu-Gi-Oh! cards are smaller than a Pokémon or Magic card, and a standard sleeve lets them slide around and catch on the shuffle. These Blackout Deck Sleeves are cut to Japanese mini size instead. You get the same fully opaque back as the standard Blackout range in a sleeve that actually holds a 59 × 86 mm card, in fourteen colours so each deck can have its own.",
    details: [
      "A properly sized sleeve does three jobs for a small card. It keeps the card centred so the edges are not the first thing to hit the table, it keeps the deck square so it shuffles without catching, and it keeps the stack slim enough to fit a standard deck box. A standard-size sleeve on a Yu-Gi-Oh! card fails at all three. The opaque back covers the card back completely, so marked or worn sleeves cannot be picked out, which is what tournament judges look for.",
      "One point catches people out: Japanese-language Pokémon cards are standard size, not mini. If you play Japanese Pokémon or One Piece, buy the standard-size Blackout sleeve (BODS-ST). The mini size is for Yu-Gi-Oh! and other games printed at the smaller Japanese card size.",
      "This is the standard-finish version. Players who want less glare and a little more grip should look at the matte Japanese mini sleeve (BODS-JPN-M). For a sealed, double-sleeved deck, put each card in a Japanese-size Mint Fit inner sleeve first, then into this. Store sleeved decks flat or upright in a closed box, out of direct sun, so the colours stay even across the whole deck.",
    ],
    highlights: [
      "Japanese mini size, cut for Yu-Gi-Oh! cards",
      "Fully opaque back hides sleeve wear",
      "Standard (non-matte) finish",
      "Pairs with Mint Fit Japanese inner sleeves",
      "14 colours",
    ],
    specs: [
      { label: "Fits", value: "Japanese-size cards such as Yu-Gi-Oh! (59 × 86 mm)" },
      { label: "Back", value: "Opaque" },
    ],
  },
  // Source: https://www.etsy.com/listing/1783672457
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "BODS-JPN-M": {
    metaDescription: "Palms Off Gaming Blackout Deck Sleeves, Japanese mini size, matte: 60 low-glare, opaque-backed sleeves for Yu-Gi-Oh! decks. Available in Australia.",
    intro: "The matte Blackout sleeve cut down to Japanese mini size, sold in packs of 60 to suit a Yu-Gi-Oh! main deck with Extra and Side Deck room to spare. The opaque back stops anyone reading your cards from behind, while the matte finish takes the shine off under store lights and gives small cards a bit of grip, which helps when you are fanning a hand of mini cards.",
    details: [
      "Small cards are fiddly. A glossy mini sleeve can stick to its neighbour, and pulling one card off the top of the deck sometimes brings two. A matte surface reduces that cling, so draws and searches are cleaner. It also keeps the table readable for your opponent and for anyone filming a feature match, since card text does not flare under overhead lighting.",
      "Sixty sleeves is a sensible count for Yu-Gi-Oh!: a 40-card main deck plus a 15-card Extra Deck leaves a few spares for swaps. If your main deck runs closer to 60, or you sleeve a Side Deck too, you will want a second pack in the same colour. The sleeve is sized for the 59 × 86 mm Japanese card format and will not suit Japanese-language Pokémon or One Piece, which are printed at standard size.",
      "Choose the matte version over the standard Japanese Blackout sleeve (BODS-JPN) if glare or grip matters to you. For double-sleeving, load the card into a Mint Fit Japanese inner sleeve first, then into this sleeve. Keep spare sleeves from the same pack, since replacing one worn sleeve with one from a different batch is easier when the colour matches.",
    ],
    highlights: [
      "60 sleeves per pack",
      "Matte finish for less glare and more grip",
      "Japanese mini size, cut for Yu-Gi-Oh!",
      "Fully opaque back",
      "14 colours",
    ],
    specs: [
      { label: "Fits", value: "Japanese-size cards such as Yu-Gi-Oh! (59 × 86 mm)" },
      { label: "Pack size", value: "60 sleeves" },
      { label: "Finish", value: "Matte" },
      { label: "Back", value: "Opaque" },
    ],
  },
  "PROS-ST-CLR": {
    metaDescription: "Palms Off Gaming Premium Over Sleeves, standard size, clear: the outer layer for double-sleeving Pokémon, Magic and sports cards. Stocked in Australia.",
    intro: "Premium Over Sleeves are the outside layer of a double-sleeve. The card goes into an inner sleeve, the inner sleeve goes into this, and every shuffle and table slide lands on a sleeve you can swap out later. The clear version is for players who want the card and its inner sleeve to show exactly as they are, with nothing printed or tinted on either side.",
    details: [
      "Double-sleeving exists because the outer sleeve is the part that wears. Edges whiten, corners split and surfaces scuff after months of play, but the inner sleeve and the card underneath stay untouched. When the outer layer looks tired you replace it, not the card. For a valuable Pokémon or Magic card that still sees play, that is cheap insurance against edge and surface wear that would knock down its grade or resale value.",
      "A clear over sleeve is also the standard way to protect art sleeves. A printed or opaque inner sleeve can slip inside a clear over sleeve so its artwork does not rub off on playmats. Load the inner sleeve upside down so its opening faces the bottom of the outer sleeve, and the card is closed on every edge. Mint Fit Inner Sleeves and Mint Fit Side-Loading Inner Sleeves are both cut to sit inside a standard outer sleeve.",
      "Pick clear when you want the cleanest look and full colour from the card art. If you play under strong lights or film matches, the matte over sleeve (PROS-ST-MAT) reduces reflections. Players with Yu-Gi-Oh! decks need the Japanese mini version (PROS-JPN-CLR).",
    ],
    highlights: [
      "Outer layer for double-sleeving",
      "Clear, so the card shows through untinted",
      "Standard size: Pokémon, Magic, One Piece, Lorcana, sports",
      "Protects art sleeves from rubbing",
      "Takes the wear so the card does not",
    ],
    specs: [
      { label: "Fits", value: "Standard-size cards (63 × 88 mm) in an inner sleeve" },
      { label: "Finish", value: "Clear" },
      { label: "Use", value: "Outer sleeve for double-sleeving" },
    ],
  },
  "PROS-ST-MAT": {
    metaDescription: "Palms Off Gaming Premium Over Sleeves, standard size, matte: low-glare outer sleeves for double-sleeved Pokémon and Magic decks. Available in Australia.",
    intro: "The matte Premium Over Sleeve does the outer-sleeve job with a finish built for the table. It slides over a card that is already in an inner sleeve, closing it in on every side, and its matte surface keeps reflections off the card face. If you double-sleeve a competitive Pokémon, Magic or Lorcana deck and play under bright fluorescent light, this is the over sleeve to use.",
    details: [
      "Matte over sleeves are popular in competitive play for practical reasons. They cut glare, so you and your opponent can read cards across the mat without tilting them. They tend to separate more easily when you draw, since matte surfaces cling to each other less than gloss. They also hide fine scratches better, so a deck still looks tidy after a weekend of rounds.",
      "Use it with any snug inner sleeve cut for standard cards. With a top-loading inner such as Mint Fit Inner Sleeves, load the inner sleeve upside down so its opening sits at the bottom of the over sleeve. With Mint Fit Side-Loading Inner Sleeves the openings already cross at right angles, so you can load the card in any order. Either way the card is sealed against dust, spills and edge wear.",
      "Choose matte over the clear version (PROS-ST-CLR) when glare, grip or hiding scuffs matters more than pure clarity; clear shows the art a shade crisper. For Yu-Gi-Oh! decks, use the Japanese mini matte version (PROS-JPN-MAT). Replace over sleeves as a set when they start to look worn, so the whole deck stays uniform.",
    ],
    highlights: [
      "Matte outer sleeve for double-sleeving",
      "Cuts glare under venue lighting",
      "Standard size for Pokémon, Magic, One Piece and Lorcana",
      "Pairs with Mint Fit top- or side-loading inner sleeves",
      "Hides fine scuffs better than gloss",
    ],
    specs: [
      { label: "Fits", value: "Standard-size cards (63 × 88 mm) in an inner sleeve" },
      { label: "Finish", value: "Matte" },
      { label: "Use", value: "Outer sleeve for double-sleeving" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "PROS-JPN-CLR": {
    metaDescription: "Palms Off Gaming Premium Over Sleeves, Japanese mini size, clear: outer sleeves for double-sleeving Yu-Gi-Oh! cards. Sold in Australia by CardPop.",
    intro: "A clear over sleeve cut to Japanese mini size, for double-sleeving Yu-Gi-Oh! cards. Put each card into a Japanese-size inner sleeve, then slide it into one of these, and the card is closed in on all four edges. The clear finish keeps the card exactly as it looks in hand, so foils, Ghost Rares and alternate art show at full strength through two layers of film.",
    details: [
      "Mini cards need properly sized outer sleeves more than standard cards do. A loose outer sleeve on a small card lets the inner sleeve shift, which leaves an edge exposed and makes the deck awkward to shuffle. An over sleeve cut for the Japanese size keeps the stack square and slim enough for a normal Yu-Gi-Oh! deck box. Keep in mind that Japanese-language Pokémon and One Piece cards are standard size and need the standard version (PROS-ST-CLR).",
      "The over sleeve is the layer that takes all the handling. Shuffling, sliding cards across a playmat and riffling through a binder all wear the outside layer first, and when it starts to whiten at the edges you replace it while the card underneath stays clean. It suits high-value staples and collector pieces that still go into a playing deck.",
      "Clear is the pick for showing off card art and for sleeving over printed art sleeves. If you play under strong lights or want a little extra grip on small cards, the matte version (PROS-JPN-MAT) is the better match. Mint Fit Japanese inner sleeves, top-loading or side-loading, are made to sit inside these.",
    ],
    highlights: [
      "Outer sleeve for double-sleeving Yu-Gi-Oh! cards",
      "Clear, so foils and art show at full strength",
      "Japanese mini size keeps a small deck square",
      "Pairs with Mint Fit Japanese inner sleeves",
      "Replaceable layer that takes the wear",
    ],
    specs: [
      { label: "Fits", value: "Japanese-size cards such as Yu-Gi-Oh! (59 × 86 mm) in an inner sleeve" },
      { label: "Finish", value: "Clear" },
      { label: "Use", value: "Outer sleeve for double-sleeving" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "PROS-JPN-MAT": {
    metaDescription: "Palms Off Gaming Premium Over Sleeves, Japanese mini size, matte: low-glare outer sleeves for double-sleeved Yu-Gi-Oh! decks. Available in Australia.",
    intro: "This matte over sleeve is sized for Japanese mini cards and is aimed at Yu-Gi-Oh! players who double-sleeve for tournaments. It goes over a card that already sits in an inner sleeve, sealing it in, and the matte surface cuts the shine from overhead lights. Small cards are also harder to pick apart than standard ones, and a matte finish gives your fingers more to work with.",
    details: [
      "In a typical Yu-Gi-Oh! game you are drawing, searching and shuffling constantly, and small double-sleeved cards can stick together or slip out of a fanned hand. Matte outer sleeves reduce that cling, so single cards come off the deck cleanly. They also hide hairline scratches, so a deck that has been through a full regional still looks even from the back.",
      "Pair it with Mint Fit Japanese inner sleeves. With the top-loading inner, flip the inner sleeve so its opening faces the bottom of the over sleeve. With the side-loading inner, the openings already cross at right angles. Either combination keeps dust and spilled drinks away from the card. Japanese-language Pokémon and One Piece cards are standard size, so they need the standard over sleeve (PROS-ST-MAT) instead.",
      "Choose matte over the clear Japanese over sleeve (PROS-JPN-CLR) for competitive play, filmed matches or bright rooms; choose clear if card art and foil shine come first. When the outer layer starts to wear at the corners, re-sleeve the whole deck at once so every card matches.",
    ],
    highlights: [
      "Matte outer sleeve sized for Yu-Gi-Oh! cards",
      "Less glare and less cling between small cards",
      "Seals the card when paired with an inner sleeve",
      "Pairs with Mint Fit Japanese top- or side-loading inners",
      "Hides fine scratches",
    ],
    specs: [
      { label: "Fits", value: "Japanese-size cards such as Yu-Gi-Oh! (59 × 86 mm) in an inner sleeve" },
      { label: "Finish", value: "Matte" },
      { label: "Use", value: "Outer sleeve for double-sleeving" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-35pt-top-loaders-25pc-clear-110062783/
  // Source: https://www.m-g.com.au/product/palms-off-gaming-top-loaders-25-pack-35pt/
  // Source: https://www.irresistibleforce.com.au/products/palms-off-gaming-top-loaders-25-pack-35pt
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collector's-series-top-loader-9-pocket-zip-binder-black-110095136/
  "TL-35PT": {
    metaDescription: "Palms Off Gaming 35pt top loaders, 25 pack: ultra-clear, rigid, 70 × 98 mm opening, the everyday size for Pokémon, Magic and sports cards in Australia.",
    intro: "These are the top loaders for ordinary cards. A 35pt rating matches the thickness of a normal modern single, so this is the size that suits the Pokémon rare you just pulled, a Magic staple you are posting to a buyer, or a rookie card waiting to be sorted. The pack holds 25 ultra-clear rigid loaders with a 70 × 98 mm internal opening, sized for a standard card in a soft sleeve.",
    details: [
      "The job of a 35pt loader is simple: stop a thin card from bending. A sleeved card slides in from the open top and the rigid walls keep it flat in a satchel, a shoebox or a trade folder. Because the opening is matched to standard-thickness stock, the card sits snugly rather than sliding around, which is what keeps corners and edges from rubbing over time.",
      "Almost every card from the major games is 35pt or close to it: Pokémon, Magic: The Gathering, One Piece, Lorcana, Yu-Gi-Oh and most base and parallel sports cards. Thicker items are where the rest of the range comes in. If a card has a jersey swatch, a patch or noticeably heavier stock, step up to 55pt or 75pt rather than forcing it, because a card squeezed into a loader that is too thin can pick up a bend at the top edge as it goes in.",
      "Put the card in a soft penny sleeve first, then into the loader; the loader is not meant to be the only layer. Filled 35pt loaders also fit the Palms Off Gaming Collector's Series 9 Pocket Top Loader Zip Binder, which is built around this size. For sellers and anyone posting cards regularly, this is the loader to keep a stack of.",
    ],
    highlights: [
      "35pt: the standard thickness of modern trading cards",
      "25 rigid, ultra-clear loaders per pack",
      "70 × 98 mm internal opening for a sleeved standard card",
      "Fits the Collector's Series top loader zip binders",
      "The go-to size for posting and storing everyday singles",
    ],
    specs: [
      { label: "Pack quantity", value: "25 top loaders" },
      { label: "Card thickness", value: "Up to 35pt" },
      { label: "Internal size", value: "70 × 98 mm" },
      { label: "Finish", value: "Ultra-clear, rigid" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-35pt-top-loaders-25pc-clear-110062783/
  "TL-55PT": {
    metaDescription: "Palms Off Gaming 55pt top loaders for cards too thick for a 35pt loader: thick-stock inserts, thin relics and heavier vintage cards. Sold in Australia.",
    intro: "A 55pt top loader is the first size up from standard, and it exists because some cards are just too thick for a 35pt sleeve-and-loader combination. Heavier chrome inserts, some older sports cards, thin memorabilia cards and certain premium parallels all fall into this bracket. If a sleeved card needs pushing to get into a 35pt loader, this is the size it should be going into instead.",
    details: [
      "The point rating on a top loader describes the thickness of card it is made to hold, with a little allowance for a soft sleeve. At 55pt there is room for card stock that is roughly half as thick again as a normal single. That extra depth is the whole point: a thick card forced into a thin loader bows the plastic and stresses the card edge, while one that fits properly slides in and out without catching.",
      "Collectors most often reach for 55pt with sports cards. Premium inserts on thick stock, low-numbered parallels from high-end products and thin single-swatch relics usually land here. On the TCG side it suits oversized-stock promos and the odd thick specialty card. Standard Pokémon, Magic and One Piece singles belong in a 35pt; anything with a chunky patch belongs further up the range in 75pt or 100pt.",
      "Measuring is easy if you have a 35pt loader on hand. If the sleeved card goes in tight, bulges the walls or will not seat at the bottom, move to 55pt. If it rattles freely in a 55pt, drop back down. Sleeve the card first in every case, then file filled loaders in a storage box or binder.",
    ],
    highlights: [
      "55pt: one step up from standard thickness",
      "For thick-stock inserts, thin relics and heavier vintage cards",
      "Stops thicker cards bowing a loader that is too thin",
      "Rigid protection for posting and storage",
      "Sleeve the card first, then load",
    ],
    specs: [
      { label: "Card thickness", value: "Up to 55pt" },
    ],
  },
  "TL-75PT": {
    metaDescription: "Palms Off Gaming 75pt top loaders for jersey, relic and single-patch cards. Rigid protection sized for thick sports inserts, for collectors across Australia.",
    intro: "75pt is the relic size. Jersey cards, single-piece patch cards and the thicker premium inserts from high-end sports products usually measure somewhere around this mark, which is well beyond what a 35pt or 55pt loader can take without strain. This loader gives those cards a rigid shell that actually fits them, so they can be posted, traded or boxed without the plastic bowing out around a swatch.",
    details: [
      "Memorabilia cards are built in layers, with a window cut into the front and a piece of fabric or material sandwiched behind it. That construction is what makes them thick, and it is also what makes them vulnerable: a card squeezed into the wrong loader can split along a layer or crease beside the window. A 75pt loader leaves enough depth for the swatch area without letting the card shift around.",
      "This is overwhelmingly a sports card size. NBA, AFL, NRL, cricket and soccer relics, autographed memorabilia cards and thick premium base cards are typical. A few TCG items such as metal or thick promotional cards may need it too, but ordinary trading card game singles are far better off in a 35pt. If a patch card has multiple pieces or a large embedded swatch, check whether 100pt suits it better.",
      "Use a sleeve sized for thick cards before loading, and store filled 75pt loaders upright in a box so the weight of the stack does not press on the window area. They also make a sensible holding stage before a card goes into a magnetic case for display.",
    ],
    highlights: [
      "75pt: sized for jersey, relic and single-patch cards",
      "Room for the swatch area without the card shifting",
      "Rigid protection for posting and storage",
      "Mostly for sports cards, including AFL and NRL relics",
      "Pair with a thick-card sleeve before loading",
    ],
    specs: [
      { label: "Card thickness", value: "Up to 75pt" },
    ],
  },
  "TL-100PT": {
    metaDescription: "Palms Off Gaming 100pt top loaders for heavy patch cards, multi-piece relics and thick memorabilia inserts. Rigid card protection for Australian collectors.",
    intro: "At 100pt the cards stop feeling like cards and start feeling like small objects. Multi-piece patches, large swatch cards, thick autographed memorabilia and cards with embedded items or cut windows usually sit here. These tend to be the most valuable cards in a sports collection, so a loader that matches their thickness matters more than at any other size, both for protection and for presentation when you sell or show them.",
    details: [
      "A 100pt card in a 75pt loader will bulge the walls, and the pressure lands right at the edges of the window or patch, which is the part buyers inspect first. Going up to 100pt removes that pressure. The card can be loaded and unloaded without scraping across the opening, and the swatch area is not being pressed against the inside face of the plastic.",
      "Typical candidates are multi-colour patch autographs, logo patches, dual and triple relics, and premium sports inserts printed on thick board. A handful of specialty collectible cards from other hobbies may also need it. Standard trading card game singles do not; keep those in 35pt.",
      "If you are unsure, compare against a 75pt loader first: if the card fits there without strain, use it, because a loader that is too deep lets the card move. If it is tight, this is the size. Choose 130pt or 180pt only for booklet cards and the thickest memorabilia. Sleeve every card before loading and keep filled loaders upright in storage. A few spare 100pt loaders are worth keeping if you open high-end sports boxes.",
    ],
    highlights: [
      "100pt: for heavy patch and multi-piece relic cards",
      "Takes the pressure off windows and embedded swatches",
      "Rigid protection for posting, showing and storage",
      "The size most high-end patch autographs need",
      "Sleeve the card before loading",
    ],
    specs: [
      { label: "Card thickness", value: "Up to 100pt" },
    ],
  },
  "TL-130PT": {
    metaDescription: "Palms Off Gaming 130pt top loaders for multi-swatch memorabilia, thin booklets and cards a 100pt loader won't close on. Sold in Australia.",
    intro: "The 130pt loader is for the cards that outgrow 100pt. Multi-swatch memorabilia, thin booklet-style cards, layered relics with several windows and some die-cut premium inserts all land in this range. Most collections only have a few cards like this, but those few are usually the ones worth protecting properly, and a correctly sized rigid loader is cheaper than one damaged corner on a card like that.",
    details: [
      "Thickness at this end of the range varies a lot from product to product, which is why the top end of the range is split into three steps rather than one. A 130pt loader gives enough room for chunky memorabilia without the card sliding loosely, as it would in a 180pt. The rigid walls stop the card flexing in a satchel or being pressed by the cards stacked around it in a box.",
      "This is a specialist size for sports collectors. Common examples are triple and quad relics, cards with large embedded objects, and slim fold-out cards. If a card fits a 100pt loader comfortably, keep it there; extra space lets it move. If it is still too thick for 130pt, the 180pt loader is the next and final step.",
      "Collectors who sell high-end sports cards often keep a few loaders in each of the larger sizes so they are not caught short when a big card sells. Sleeve the card first, load it from the open end, and store filled loaders upright rather than lying flat under other items.",
    ],
    highlights: [
      "130pt: for multi-swatch memorabilia and thin booklet cards",
      "The middle of the three heavy-duty sizes",
      "Rigid protection for thick, high-value sports cards",
      "Fits cards that will not close in a 100pt loader",
      "Sleeve the card before loading",
    ],
    specs: [
      { label: "Card thickness", value: "Up to 130pt" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-180pt-top-loaders-10pc-clear-110094016/
  "TL-180PT": {
    metaDescription: "Palms Off Gaming 180pt top loaders, 10 pack, for the thickest booklet and memorabilia cards. The largest point size in the range, sold in Australia.",
    intro: "180pt is the largest card thickness in the Palms Off Gaming top loader range, and the 10 pack is aimed at the outliers. Booklet cards, heavily layered memorabilia and thick-board premium cards that will not close in a 130pt loader go here. If you collect high-end sports products, there is usually at least one card a year that needs this size, and it is better to have the loader before that card arrives.",
    details: [
      "Big cards are not just thicker; they are heavier, and that weight is what bends a card when it is posted in something too flexible. A 180pt loader gives a rigid frame around the full card and enough depth that the thick part of the card does not press against the walls. Retailers list the 70 × 98 mm opening as made for sports and other trading cards up to 180pt.",
      "Use it for booklets, multi-layer patch cards, cards with embedded objects and premium inserts printed on very thick board. Avoid using it for thinner cards just because it is to hand: a standard card will slide about inside, which is exactly the movement a loader is supposed to prevent. Anything that fits a 130pt or 100pt should stay in those.",
      "Ten loaders is a sensible quantity for a size most people use only occasionally. Sleeve the card in a suitably large sleeve first, load it from the open end and keep the filled loader upright in a box. A loader that fits properly also photographs better when the card is listed for sale, because the card sits straight behind the clear face.",
    ],
    highlights: [
      "180pt: the largest point size in the range",
      "10 rigid, clear loaders per pack",
      "For booklets and the thickest memorabilia cards",
      "70 × 98 mm opening listed for sports and trading cards",
      "Sleeve the card first",
    ],
    specs: [
      { label: "Pack quantity", value: "10 top loaders" },
      { label: "Card thickness", value: "Up to 180pt" },
      { label: "Internal size", value: "70 × 98 mm" },
    ],
  },
  // Source: https://otakumart.co.nz/products/booster-pack-top-loaders-10pc-palms-off
  // Source: https://www.kmart.com.au/product/palms-off-gaming-booster-pack-top-loaders-standard-size-10pc-clear-110062669/
  // Source: https://www.kollecter.com.au/products/booster-pack-top-loaders-standard-size-10pc
  "TL-PACK": {
    metaDescription: "Palms Off Gaming booster pack top loaders, 10 pack: PVC-free, ultra-clear, 70 × 121 mm inside, for Pokémon, Magic and One Piece boosters in Australia.",
    intro: "This loader is built for a sealed booster pack rather than a single card. Each of the 10 loaders has a 70 × 121 × 4.5 mm interior and takes common packs up to 200pt thick, which covers standard 10 to 12 card boosters from Pokémon, One Piece, Dragon Ball and Magic set boosters. The plastic is PVC-free, museum-grade and ultra-clear, and ships with a removable protective film.",
    details: [
      "Sealed packs lose value the moment they get crimped corners, scuffed foil or a fold across the middle. A rigid loader stops all three. The pack stays flat on a shelf or in a box, the wrapper is not rubbing against its neighbours, and it can be posted without bending.",
      "These are popular with pack breakers. A pack sold on a live stream can go into a loader, get a tamper-evident seal across the opening and be posted to the buyer still sealed, which gives both sides confidence the pack is the one that was sold. Collectors keeping a single pack from each set, or holding promo packs, get the same benefit at home.",
      "The loaders are safe to use directly against the pack wrapper, so a sleeve is optional. If you prefer the extra layer, they work with MintFit booster pack sleeves. Peel the protective film before display. For a single card, choose the 35pt top loader instead; this size is too long for a card to sit still. Store loaded packs upright in a box so the wrappers are not pressed flat under weight.",
    ],
    highlights: [
      "10 loaders sized for a sealed booster pack",
      "Fits common packs up to 200pt thick",
      "PVC-free, museum-grade, ultra-clear plastic",
      "Removable protective film on each loader",
      "Safe without a pack sleeve; works with MintFit pack sleeves",
      "Handy for pack breaks with tamper seals",
    ],
    specs: [
      { label: "Pack quantity", value: "10 top loaders" },
      { label: "Internal size", value: "70 × 121 × 4.5 mm (W × H × D)" },
      { label: "Fits", value: "Booster packs up to 200pt thick" },
      { label: "Material", value: "PVC-free, museum-grade plastic" },
      { label: "Finish", value: "Ultra-clear, with removable protective film" },
    ],
  },
  "MAG-35PT": {
    metaDescription: "Palms Off Gaming Mag Lock Card Case 35pt: a magnetic one-touch display case for standard Pokémon, Magic and sports cards. Clear both sides, sold in Australia.",
    intro: "The 35pt Mag Lock is the one-touch for the cards you want to look at, not just store. It is sized for standard-thickness modern cards, the same stock as almost every Pokémon, Magic, One Piece, Lorcana and base sports card. Two clear acrylic halves close around the card with a magnetic seal, so it is held still without screws, clips or tape, and both faces stay visible.",
    details: [
      "A top loader keeps a card flat, but it is soft at the open end and looks like storage. A magnetic case is rigid on every side and closes fully, so the card is enclosed rather than sitting in a sleeve with an open top. That makes it the better choice for a card on a shelf, a stand or a display table at a show.",
      "Getting the thickness right is what keeps a one-touch working. A 35pt card in a 35pt case sits in its recess without sliding, so its edges and corners are not tapping against the frame every time the case is picked up. Thicker cards should go up the range: 55pt for heavier stock, 75pt and above for relics and patches.",
      "To load it, separate the two halves along the magnetic join, lay the card in the recess and close the lid; it opens again by hand whenever you want to sell, grade or swap the card. Raw cards bound for grading should come out of the case and go into a semi-rigid holder before submission.",
    ],
    highlights: [
      "35pt: fits standard modern trading cards",
      "Magnetic closure, no screws or tools",
      "Clear acrylic on both faces for display",
      "Rigid on every side, not open at one end",
      "A display step up from a top loader",
    ],
    specs: [
      { label: "Card thickness", value: "35pt" },
      { label: "Closure", value: "Magnetic" },
    ],
  },
  "MAG-55PT": {
    metaDescription: "Palms Off Gaming Mag Lock Card Case 55pt: a magnetic one-touch for thick-stock inserts and thin relics too thick for a 35pt case. In Australia.",
    intro: "The 55pt Mag Lock is for cards that are a little too thick for a standard case. Heavier chrome and premium inserts, thin single-swatch relics and some older cards on thick board tend to measure here. In a 35pt case those cards press against the lid and the magnets will not seat flush; in a 55pt one they sit properly in the recess with both faces clear and the magnetic closure fully shut.",
    details: [
      "A one-touch is meant to hold a card firmly without squeezing it. Too small and the case pushes on the surface and edges; too big and the card shifts and wears its corners against the frame. The 55pt case covers the gap between ordinary cards and true memorabilia, which is where a lot of sports inserts and premium parallels sit.",
      "It suits numbered inserts from high-end sports products, thin jersey cards, and specialty TCG cards on heavier stock. Standard Pokémon, Magic or One Piece singles should go in the 35pt case instead, and anything with a noticeable patch is better in 75pt or 100pt.",
      "If you are not sure which size a card is, try it in a 35pt case first. If the lid will not close without pressure, this is the size it needs. The case opens by hand when you want the card out, which makes it easy to move a card to a semi-rigid holder before a grading submission. On a shelf, a stand behind the case keeps it upright and lets both faces be seen.",
    ],
    highlights: [
      "55pt: for thick-stock inserts and thin relics",
      "Magnetic closure that opens by hand",
      "Clear acrylic on both faces for display",
      "Fills the gap between standard cards and memorabilia",
      "Holds the card still without pressing on it",
    ],
    specs: [
      { label: "Card thickness", value: "55pt" },
      { label: "Closure", value: "Magnetic" },
    ],
  },
  "MAG-75PT": {
    metaDescription: "Palms Off Gaming Mag Lock Card Case 75pt: magnetic one-touch for jersey, relic and single-patch sports cards. Clear on both sides, sold in Australia.",
    intro: "The 75pt Mag Lock is the display case for relic cards. Jersey swatches, single-colour patches and thick premium inserts usually measure around this thickness, and they are the kind of card people want to see from both sides. This clear acrylic case gives them a rigid, fully closed home held shut by magnets, so the swatch can be shown off without the card being handled.",
    details: [
      "A relic card has a window cut into the front and material layered behind it. In a case that is too shallow the window area takes the pressure, and in one that is too deep the card rattles. At 75pt the recess suits the depth of a typical single-piece relic, so the card sits flat with the swatch facing out.",
      "This is chiefly a sports card size, popular with AFL, NRL, NBA and soccer collectors displaying a favourite player's jersey card. Multi-piece patches and heavy memorabilia will usually need the 100pt case; ordinary inserts belong in 35pt or 55pt.",
      "Cases like this are often used on a shelf with a stand, or in a display box at a show table. Open the magnetic join by hand to load the card face up into the recess, close the lid and check it sits flat. If the lid will not close cleanly, try the next size up. Keep spare cases in their box until needed so the acrylic faces stay free of scratches.",
    ],
    highlights: [
      "75pt: sized for jersey, relic and single-patch cards",
      "Magnetic closure that opens by hand",
      "Clear acrylic on both faces",
      "Shows off the swatch without handling the card",
      "Popular for AFL, NRL and NBA relics",
    ],
    specs: [
      { label: "Card thickness", value: "75pt" },
      { label: "Closure", value: "Magnetic" },
    ],
  },
  "MAG-100PT": {
    metaDescription: "Palms Off Gaming Mag Lock Card Case 100pt: a magnetic one-touch for patch autographs, multi-piece relics and heavy inserts. Sold in Australia.",
    intro: "The 100pt Mag Lock is built for heavy patch cards. Multi-colour patch autographs, dual and triple relics and thick memorabilia inserts usually sit at around 100pt, and these are often the most valuable raw cards in a sports collection. The case wraps the card in clear acrylic on both faces and closes with magnets, so it can be picked up, passed around or put on display without anyone touching the card itself.",
    details: [
      "A thick memorabilia card is more fragile than it looks. The layers that hold the patch can separate if the card is squeezed, and the edges of the window are the first place a buyer looks for wear. A case matched to 100pt holds the card firmly at the edges without pressing on the patch.",
      "Pick this size for patch autographs, logo patches, multi-piece relics and premium sports cards printed on thick board. If the card fits a 75pt case without resistance, use that, since extra depth lets it move. The thickest booklets and memorabilia cards need 130pt or 180pt.",
      "Load it by separating the halves, laying the card in the recess face up and closing the lid. A 100pt case on a stand makes a sensible centrepiece on a display shelf. If the card is going to be graded, take it out and move it to a semi-rigid holder before posting it to the grader. Wipe the acrylic with a soft microfibre cloth rather than paper towel to avoid fine scratches.",
    ],
    highlights: [
      "100pt: for patch autographs and multi-piece relics",
      "Holds the edges without pressing on the patch",
      "Magnetic closure, opens by hand",
      "Clear acrylic on both faces",
      "Suits high-value raw sports cards on display",
    ],
    specs: [
      { label: "Card thickness", value: "100pt" },
      { label: "Closure", value: "Magnetic" },
    ],
  },
  "MAG-130PT": {
    metaDescription: "Palms Off Gaming Mag Lock Card Case 130pt: magnetic one-touch for multi-swatch memorabilia and thin booklet cards too thick for 100pt. Sold in Australia.",
    intro: "The 130pt Mag Lock is the case for memorabilia that a 100pt case will not close on. Multi-swatch relics, cards with large embedded pieces and slim booklet-style cards usually need this much depth. Most collectors only own a handful of cards like that, so this is a case you buy for a specific card rather than in bulk, and the fit matters because those cards are rarely cheap.",
    details: [
      "Thickness across premium memorabilia varies a lot from product to product, which is why the top of the Mag Lock range comes in three steps. The 130pt sits in the middle: deep enough for heavily layered cards, without the extra space of the 180pt case that would let a slimmer card slide around.",
      "It is the right choice for quad relics, cards with bat or glove pieces, and fold-over cards that are slim when closed. If a card already fits a 100pt case cleanly, keep it there. If the lid still will not shut at 130pt, move to the 180pt case.",
      "Clear acrylic on both faces lets the full card be seen, and the magnetic closure means it can come out again without tools when it is time to sell. Put a case this size on a stand for display, or keep it in a box with other one-touches when it is not on show. A microfibre cloth keeps the acrylic clear for photographs without leaving fine scratches, and a stand keeps the case upright on a shelf.",
    ],
    highlights: [
      "130pt: for multi-swatch memorabilia and thin booklets",
      "Deep enough for layered cards without excess room",
      "Magnetic closure, opens by hand",
      "Clear acrylic on both faces",
      "For the card a 100pt case will not close on",
    ],
    specs: [
      { label: "Card thickness", value: "130pt" },
      { label: "Closure", value: "Magnetic" },
    ],
  },
  "MAG-180PT": {
    metaDescription: "Palms Off Gaming Mag Lock Card Case 180pt: the deepest magnetic one-touch in the range, for booklet cards and heavy memorabilia. Sold in Australia.",
    intro: "The 180pt Mag Lock is the deepest case in the range. It is meant for booklet cards, heavily layered memorabilia and premium cards on very thick board, the cards no other one-touch will close around. If you collect high-end sports products, this is the case for the box-hit that comes out of the pack noticeably heavier than everything else, and it keeps that card visible from both sides.",
    details: [
      "Large cards carry more weight, and weight is what makes a card move inside a case that is loose or bow in one that is tight. At 180pt the recess is deep enough for the thickest common memorabilia formats, with the magnetic lid sitting flush once the card is in place.",
      "Use it for booklets, oversized relic cards and memorabilia cards that will not fit in 130pt. Do not use it for thinner cards just because one is spare: a 35pt card in a 180pt case will slide around freely, which defeats the purpose. Most collections will only need one or two at this size.",
      "Open the halves along the magnetic join, set the card into the recess face up and close the lid gently so it seats evenly. Because both faces are clear, a 180pt case works well on a stand where the back of a booklet card can be seen as well as the front. Wipe the faces with a microfibre cloth before photographing the card for a sale listing.",
    ],
    highlights: [
      "180pt: the deepest Mag Lock case",
      "For booklet and heavy memorabilia cards",
      "Magnetic closure, opens by hand",
      "Clear acrylic on both faces",
      "Use only for cards that will not fit 130pt",
    ],
    specs: [
      { label: "Card thickness", value: "180pt" },
      { label: "Closure", value: "Magnetic" },
    ],
  },
  "GCC-S": {
    metaDescription: "Palms Off Gaming Collector's Series Small Graded Card Case: a compact hard carry case for a few PSA, CGC or BGS slabs. Seven colours, sold in Australia.",
    intro: "The small Collector's Series case is the one to grab when only a few graded cards are leaving the house. It is a hard carry case built around slab dimensions, so a short stack of slabs sits snugly instead of sliding around in a backpack. It suits a trip to a card show, a meet-up with a buyer, or carrying a fresh return from the grader home from the post office. Seven colours.",
    details: [
      "Graded slabs are tough, but they scratch and chip when they rub against each other or against keys and cables. Keeping them in a dedicated hard case stops that, and it makes slabs easier to find and count on the way out of an event.",
      "Choose the small size if you take a handful of slabs out at a time: your best few cards to show, a trade bundle, or a sale you are handing over in person. It is easy to slip into a bag beside a binder. Collectors who travel with more than a small selection should look at the medium, and anyone moving a full graded collection will want the large.",
      "The seven colours are useful beyond looks. Assign one colour to cards for sale and another to keepers, or one per game, so the right case leaves the house without opening every one. Pair the case with slab sleeves if you want to keep the acrylic face scratch-free as well. A small case is also a tidy way to keep a few slabs together at home between outings, away from dust and direct sun.",
    ],
    highlights: [
      "Hard carry case sized around graded slabs",
      "Smallest of three sizes: for a few slabs at a time",
      "Stops slabs rubbing and chipping in a bag",
      "Seven colours for colour-coding collections",
      "Good for shows, meet-ups and buyer handovers",
    ],
    specs: [
      { label: "Size", value: "Small" },
      { label: "Fits", value: "Graded card slabs" },
    ],
  },
  "GCC-M": {
    metaDescription: "Palms Off Gaming Collector's Series Medium Graded Card Case: a hard slab carry case for a solid selection of graded cards. Seven colours, sold in Australia.",
    intro: "The medium Collector's Series case sits between the small and large in the range, and suits collectors who want to take a decent selection of slabs out without packing the whole collection. Like the others in the series, it is a hard carry case sized around graded slabs, so a run of PSA, CGC or BGS cards stays upright and separated rather than knocking together. Seven colours.",
    details: [
      "For most people, the medium is the size that covers the usual outing: a trade night, a show where you want options to swap, or a visit to a shop to get slabs appraised. It holds more than the small without becoming bulky to carry around for a day.",
      "Pick it over the small if you regularly bring more than a handful of slabs, or if you buy at shows and want room to bring new pick-ups home safely. Pick the large instead if you are setting up a table, moving house, or storing an entire graded collection in one place.",
      "Colour-coding helps once you own more than one case. The medium comes in seven colours, which makes it easy to keep, for example, Pokémon slabs in yellow, sports in black and trade stock in red. Put a slab sleeve on any card with a pristine case face, and keep the carry case closed and upright when it is not in use. It also doubles as tidy home storage for a mid-sized graded collection, keeping slabs out of dust and direct sunlight.",
    ],
    highlights: [
      "Hard carry case sized around graded slabs",
      "Mid-size: a proper selection, not the whole collection",
      "Room for show pick-ups on the way home",
      "Seven colours for colour-coding by game or purpose",
      "Keeps slabs separated and upright in transit",
    ],
    specs: [
      { label: "Size", value: "Medium" },
      { label: "Fits", value: "Graded card slabs" },
    ],
  },
  "GCC-L": {
    metaDescription: "Palms Off Gaming Collector's Series Large Graded Card Case: the biggest slab carry case in the series, for whole graded collections. Five colours.",
    intro: "The large Collector's Series case is the one for moving a graded collection all at once. It is the biggest of the three sizes, a hard carry case sized around slabs so a full run of graded cards can travel to a show table, a new house or a buyer without being stacked loose in a box. Five colours are available.",
    details: [
      "Once a collection reaches a certain size, carrying slabs in several small containers becomes its own problem: something gets left behind or packed loosely. A single large case keeps everything in one place, separated, and easy to count before you leave and again when you arrive.",
      "It suits sellers running a table at a card show, collectors moving house, and anyone handing over a large graded purchase in person. It also works as home storage when shelves are not an option. If you only take a few cards out at a time, the small or medium case will be easier to carry.",
      "Use the colours to separate stock from personal collection, or one game from another. For the most valuable slabs, add a slab sleeve so the acrylic stays clear for photographs. Keep the case closed and stored flat or upright, away from direct sun, when it is full. For shows, pack the slabs in the order you plan to lay them out, so setting up the table is quick and nothing is left in the case by mistake.",
    ],
    highlights: [
      "Hard carry case sized around graded slabs",
      "Largest of three sizes: for a whole graded collection",
      "Good for show tables, moving house and big handovers",
      "Keeps a large run of slabs in one organised place",
      "Five colours",
    ],
    specs: [
      { label: "Size", value: "Large" },
      { label: "Fits", value: "Graded card slabs" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-grading-holders-semi-rigid-200pc-clear-110062835/
  // Source: https://groovy.tcgsync.com/products/palms-off-grading-holders
  "SRGH-200": {
    metaDescription: "Palms Off Gaming semi-rigid grading holders, 200 pack: 83 × 123 mm card savers with an easy-insert lip for PSA and other submissions. Shop them in Australia.",
    intro: "This is the bulk box of Palms Off Gaming semi-rigid grading holders: 200 clear holders at 83 × 123 mm, the format collectors use to send raw cards off for grading. Each one has an easy-insert lip, and the box itself is reusable for storage with a label on the outer carton to help organise a submission. It suits regular submitters, group-submission organisers and shops sending cards on behalf of customers.",
    details: [
      "A semi-rigid holder is the card saver PSA prefers for submissions, and most other graders accept the same format. It is stiff enough to stop a card flexing or rubbing in the post, yet bends just enough that a grader can slide the card out without cutting anything. Hard top loaders are harder for graders to open and are commonly discouraged.",
      "The holders fit a standard-size card in a penny sleeve: Pokémon, Magic, One Piece, Lorcana, Yu-Gi-Oh and standard sports cards. Slide the sleeved card in under the lip, add a strip of painter's tape or a pull tab across the opening if your grader asks for one, and stack the holders between two pieces of card for the trip.",
      "The 200 pack makes sense once you are submitting more than a few dozen cards a year. It is the same holder as the 50 pack, just in a quantity that means you are not short when a big submission comes together. The spare holders also make good storage for cards waiting to be sorted.",
    ],
    highlights: [
      "200 semi-rigid holders in a reusable storage box",
      "83 × 123 mm, for standard-size trading cards",
      "Easy-insert lip and ultra-clear plastic",
      "Stops cards rubbing and shifting in transit",
      "Labelled outer carton to organise submissions",
      "The holder format PSA prefers for submissions",
    ],
    specs: [
      { label: "Pack quantity", value: "200 holders" },
      { label: "Size", value: "83 × 123 mm" },
      { label: "Fits", value: "Standard-size trading cards" },
      { label: "Features", value: "Easy-insert lip, ultra-clear plastic" },
      { label: "Packaging", value: "Reusable storage box with labelled outer carton" },
    ],
  },
  // Source: https://groovy.tcgsync.com/products/mintfit-psa-graded-card-sleeves-regular-100pc
  "MF-PSA-REG": {
    metaDescription: "Mint Fit PSA slab sleeves, Regular: 100 clear 50 micron polypropylene sleeves with a resealable lip, sized for standard PSA graded cases. Acid and PVC free.",
    intro: "PSA cases scratch in ordinary ways: dragged across a desk, packed against other slabs in a box, handled at a card show. These Mint Fit sleeves give the case a fitted outer layer so the acrylic stays clear. Each pack holds 100 sleeves in 50 micron polypropylene, cut at 86 × 137 mm with a resealable lip, which is a close fit over a standard PSA slab rather than a loose bag.",
    details: [
      "A standard PSA case measures roughly 80 × 135 mm and about 6 mm deep. The sleeve body is 86 × 137 mm, so there is enough allowance for the slab's depth to slide in without force, but not so much that the case rattles around inside. The tapered resealable lip folds over the top and holds the sleeve shut, and it opens again without tearing, which matters if you pull slabs out to photograph or show them.",
      "The film is polypropylene at 50 micron, acid free and without PVC, so it is suitable for slabs that sit in storage for years. High clarity is the point of a slab sleeve: the label, grade and card need to read straight through it, both in person and in a listing photo. The sleeve also takes the light scuffs that would otherwise land on the case itself.",
      "Choose the Regular version for everyday PSA slabs going into a box, a slab case or the post. If you would rather have a heavier film for slabs that are handled or shipped often, look at the Extra Thick version of the same sleeve. For Beckett cases, use the BGS sleeve instead, because BGS slabs are a different shape to PSA.",
    ],
    highlights: [
      "100 sleeves per pack",
      "50 micron polypropylene, acid free and PVC free",
      "86 × 137 mm body with a tapered resealable lip",
      "Fits standard PSA slabs (about 80 × 135 × 6 mm)",
      "High clarity so the label and grade read through the sleeve",
    ],
    specs: [
      { label: "Pack size", value: "100 sleeves" },
      { label: "Material", value: "Polypropylene, 50 micron" },
      { label: "Sleeve size", value: "86 × 137 mm plus resealable lip" },
      { label: "Fits", value: "Standard PSA graded slabs (approx. 80 × 135 × 6 mm)" },
      { label: "Closure", value: "Tapered resealable lip" },
      { label: "Archival", value: "Acid free, PVC free" },
    ],
  },
  "MF-PSA-EX": {
    metaDescription: "Mint Fit PSA slab sleeves in Extra Thick from Palms Off Gaming: a heavier sleeve for PSA graded cases that get handled, shipped or shown at events often.",
    intro: "This is the Extra Thick member of the Mint Fit PSA sleeve pair. It does the same job as the Regular version, putting a fitted, clear layer between a PSA slab and everything that might scratch it, but in a heavier sleeve. That makes it the better choice for slabs that live a harder life: posted to buyers, carried in a case to trade nights, or passed across tables for inspection.",
    details: [
      "A PSA slab protects the card, but nothing protects the slab. Its acrylic face is what buyers look at first, and fine scratches from storage boxes and handling show up clearly in photos. A slab sleeve is cheap insurance against that, and the Mint Fit sleeves are cut for PSA's case shape specifically, so they sit close rather than bunching.",
      "The difference between the two Mint Fit PSA sleeves is the thickness of the sleeve itself. The Regular version is a light 50 micron film that suits slabs stored in a box at home. The Extra Thick version trades a little of that lightness for more body, which helps when a slab is going into a mailer, being stacked in a travel case, or being picked up dozens of times at an event.",
      "For a mixed collection, many people use both: Regular for the slabs that stay put, Extra Thick for the ones that move. If your slabs are BGS rather than PSA, use the Mint Fit BGS sleeve, since the two graders use differently shaped cases and a PSA sleeve will not sit properly on a Beckett slab.",
    ],
    highlights: [
      "Sized for PSA graded slabs",
      "Extra Thick sleeve for slabs that travel or get handled",
      "Keeps the acrylic face clear for photos and resale",
      "Pairs with the Regular version for slabs that stay in storage",
      "Use the BGS sleeve for Beckett cases",
    ],
    specs: [
      { label: "Fits", value: "PSA graded slabs" },
      { label: "Thickness", value: "Extra Thick" },
    ],
  },
  "MF-BGS-REG": {
    metaDescription: "Mint Fit BGS slab sleeves, Regular, from Palms Off Gaming: clear outer sleeves sized for Beckett graded cases, so the slab stays scratch free in storage.",
    intro: "Beckett slabs are a different shape to PSA cases, so a PSA sleeve either will not go on or sits awkwardly. This Mint Fit sleeve is the Regular version cut for BGS cases. It gives a Beckett slab its own clear outer layer, keeping the case face free of the fine scratches that come from boxes, binders and handling, and that a buyer will spot straight away in a listing photo.",
    details: [
      "Beckett and PSA both encapsulate cards in hard acrylic, but the outer dimensions and the label area differ. Buying sleeves cut for the right grader is what stops the sleeve bunching at one end or stretching at the other. Mint Fit splits its slab sleeves by grader for exactly that reason, and this one is for BGS.",
      "Sleeving slabs is mostly about the case rather than the card. The card is already sealed, but the acrylic around it is what people judge at first glance, and a scuffed case drags down how a premium card presents even when the grade is high. A clear sleeve takes that contact instead, and can be replaced if it ever gets worn.",
      "Use these for BGS slabs going into a storage box, a slab case, or a mailer. They also make sense for slabs on display that get picked up and looked at. If part of your collection is graded by PSA, pick up the Mint Fit PSA sleeves for those, in Regular or Extra Thick, so each slab gets a sleeve shaped for its case.",
    ],
    highlights: [
      "Sized for BGS (Beckett) graded slabs",
      "Regular version of the Mint Fit slab sleeve",
      "Keeps case acrylic clear for photos and resale",
      "Separate from the PSA sleeves because the case shapes differ",
    ],
    specs: [
      { label: "Fits", value: "BGS (Beckett) graded slabs" },
      { label: "Version", value: "Regular" },
    ],
  },
  "MF-MAG-35": {
    metaDescription: "Mint Fit sleeves for 35pt to 75pt mag lock card cases from Palms Off Gaming. A clear outer sleeve so magnetic one-touch cases stay unscratched in storage.",
    intro: "Magnetic one-touch cases look their best on day one. After that, they rub against each other in boxes and pick up scratches on the face that show in every photo. This Mint Fit sleeve fits mag lock cases rated 35pt to 75pt, the range that covers standard cards through to thicker parallels and many numbered inserts, so a case can be stored, stacked or posted without wearing its face.",
    details: [
      "Mag lock cases are rated in points, the same thickness scale used for top loaders. A 35pt case suits a standard card, while 55pt and 75pt cases take thicker stock. These sleeves cover that whole 35pt to 75pt band, which is where most raw cards worth putting in a magnetic case actually sit, so one pack can serve a mixed shelf of cases.",
      "The sleeve's job is to protect the case rather than the card. Magnetic cases are often bought for display, and a clear case with a scratched face undoes that. Sleeving them also helps when cases are stacked in a box or slid into a storage drawer, since acrylic rubbing on acrylic is the usual cause of haze and fine marks.",
      "Pick this version for cases from 35pt to 75pt. For the bigger cases used with patch, relic and other thick memorabilia cards, the 100pt to 130pt Mint Fit sleeve is the right size, as the smaller sleeve will not go over a deeper case. If you are unsure of a case rating, check the packaging it came in before choosing a sleeve.",
    ],
    highlights: [
      "Fits mag lock card cases from 35pt to 75pt",
      "Protects the case face from scratches and haze",
      "Suits stacking, storage and posting",
      "Covers standard through to thicker card stock",
      "Use the 100pt to 130pt version for deeper cases",
    ],
    specs: [
      { label: "Fits", value: "Mag lock (magnetic one-touch) card cases, 35pt to 75pt" },
    ],
  },
  "MF-MAG-130": {
    metaDescription: "Mint Fit sleeves for 100pt to 130pt mag lock card cases from Palms Off Gaming. Sized for the deep cases that hold patch, relic and memorabilia cards.",
    intro: "Thick cards need deep cases, and deep cases need a sleeve that will actually fit around them. This Mint Fit sleeve is made for mag lock cases rated 100pt to 130pt, the sizes used for patch cards, relics, jersey swatches and other memorabilia inserts. Those tend to be the most valuable cards in a sports or TCG collection, which makes the case around them worth keeping clear.",
    details: [
      "Point ratings describe how thick a card a case is built to hold. A 100pt to 130pt case is several times deeper than the 35pt case a standard card uses, so a sleeve made for slimmer cases will not stretch around it. This sleeve covers the deeper end of the scale and leaves the smaller cases to the 35pt to 75pt version.",
      "Big memorabilia cards are often displayed rather than boxed, and a display case gets picked up, turned over and set back down far more than a stored one. Each of those moments can leave a mark on the acrylic. A clear outer sleeve takes that contact, so the case still looks clean when it is photographed for a listing or handed over in a trade.",
      "These are also handy for sending thick cards in the post, where cases can be packed against each other in a mailer. If your collection runs across sizes, keep a pack of each: the 35pt to 75pt sleeve for standard cards and thicker parallels, and this one for anything 100pt and above.",
    ],
    highlights: [
      "Fits mag lock card cases from 100pt to 130pt",
      "Made for patch, relic and memorabilia card cases",
      "Keeps display cases clear for photos and trades",
      "Use the 35pt to 75pt version for slimmer cases",
    ],
    specs: [
      { label: "Fits", value: "Mag lock (magnetic one-touch) card cases, 100pt to 130pt" },
    ],
  },
  // Source: https://otakumart.co.nz/products/mint-fit-toploader-sleeves-35pt-100pc-palms-off
  // Source: https://groovy.tcgsync.com/products/palms-off-top-loader-sleeves
  "MF-TL-35PT": {
    metaDescription: "Mint Fit 35pt top loader sleeves from Palms Off Gaming: 100 ultra-clear polypropylene sleeves, acid free and PVC free, packed in a storage tray.",
    intro: "A top loader has an open end, and that is where dust gets in. These Mint Fit sleeves cover a standard 35pt top loader completely, so the card inside is sealed off from dust and grime and the loader's face is kept off other loaders in a box. The pack has 100 sleeves in ultra-clear polypropylene, acid free and PVC free, and arrives in its own tray.",
    details: [
      "35pt is the most common top loader size, the 3 × 4 inch rigid holder that takes a standard card in a penny sleeve. These sleeves are cut for that loader, not for a bare card, so they slide over the whole holder and close off the open top. That is the difference between a loader that collects fluff over a year in a drawer and one that comes out clean.",
      "Sleeving loaders also stops them scratching each other. Rigid top loaders stacked side by side will scuff, and a scuffed loader makes even a clean card look tired in a listing photo. A clear outer sleeve keeps the loader presentable without hiding the card.",
      "The included tray keeps unused sleeves flat and in a neat stack, which helps when you are sleeving a pile of loaders in one sitting. Use these for trade binders, stock boxes and cards waiting to be posted. For the larger loaders that hold sealed booster packs, choose the Mint Fit Booster Pack Top Loader Sleeves instead.",
    ],
    highlights: [
      "100 sleeves per pack",
      "Fits standard 35pt top loaders",
      "Ultra-clear polypropylene, acid free and PVC free",
      "Seals the loader's open end against dust",
      "Supplied in a tray for tidy storage",
    ],
    specs: [
      { label: "Pack size", value: "100 sleeves" },
      { label: "Fits", value: "Standard 35pt top loaders" },
      { label: "Material", value: "Ultra-clear polypropylene" },
      { label: "Archival", value: "Acid free, PVC free" },
      { label: "Packaging", value: "Built-in storage tray" },
    ],
  },
  // Source: https://groovy.tcgsync.com/products/mintfit-booster-pack-top-loader-sleeves-50pc
  // Source: https://www.ebay.de/itm/196260962316
  "MF-TL-PACK": {
    metaDescription: "Mint Fit booster pack top loader sleeves: 50 clear 50 micron polypropylene sleeves, 83.5 × 127 mm with a resealable lip, for pack-sized top loaders.",
    intro: "A booster pack top loader is bigger than a card loader, so it needs its own sleeve. These Mint Fit sleeves are cut at 83.5 × 127 mm plus a resealable lip, to fit most pack-sized top loaders. There are 50 per pack, made from 50 micron polypropylene that is acid free and PVC free, so a sealed pack can sit loaded and sleeved for the long term.",
    details: [
      "Rigid pack loaders protect the pack from bending, but they are open at one end and their faces scratch against each other in storage. An outer sleeve fixes both. The tapered resealable lip folds over the opening so dust cannot work its way in, and the clear film takes the rubbing that would otherwise mark the loader.",
      "Clarity matters with sealed product because the pack's artwork and crimps are what a buyer is checking. These sleeves are high clarity, so labels and pack art read through clearly in person and on camera. That suits collectors keeping chase packs, sellers listing sealed singles, and anyone showing packs in a stream before they are opened.",
      "For the most protection, double up: put the pack in a Mint Fit Extra Thick booster pack sleeve, slide it into a booster pack top loader, then cover the loader with one of these. Check the size of your loaders if they come from a different brand, since pack loaders vary more than card loaders. For standard card top loaders, use the Mint Fit 35pt Top Loader Sleeves.",
    ],
    highlights: [
      "50 sleeves per pack",
      "Fits most booster pack top loaders",
      "83.5 × 127 mm with a tapered resealable lip",
      "50 micron polypropylene, acid free and PVC free",
      "High clarity for pack art and labels",
    ],
    specs: [
      { label: "Pack size", value: "50 sleeves" },
      { label: "Material", value: "Polypropylene, 50 micron" },
      { label: "Sleeve size", value: "83.5 × 127 mm plus resealable lip" },
      { label: "Fits", value: "Most booster pack top loaders" },
      { label: "Closure", value: "Tapered resealable lip" },
      { label: "Archival", value: "Acid free, PVC free" },
    ],
  },
  // Source: https://groovy.tcgsync.com/products/mintfit-booster-pack-sleeves-extra-thick-50pc
  "MF-PACK-EX": {
    metaDescription: "Mint Fit Extra Thick booster pack sleeves: 50 clear 100 micron polypropylene sleeves, 73 × 120 mm with a resealable lip, for sealed TCG booster packs.",
    intro: "Sealed booster packs lose value through small things: a creased corner, a scuffed foil wrapper, a split crimp. These Mint Fit sleeves wrap each pack in 100 micron polypropylene, about double the 50 micron film used on the lighter Mint Fit lines. Each pack has 50 sleeves at 73 × 120 mm with a resealable lip, sized for most standard trading card packs of around ten cards.",
    details: [
      "The extra thick film is the reason to choose these. Pack wrappers are thin foil and crease easily, and a heavier sleeve resists folding, so the pack inside keeps its shape when it is handled, stacked or posted. The tapered resealable lip closes the sleeve without adhesive touching the wrapper, and opens again cleanly.",
      "The film is acid free and contains no PVC, so packs can stay sleeved long term. It is also high clarity, which matters for sealed product: buyers want to see the artwork, the set symbol and the condition of the crimps without the pack being taken out. That makes these useful for anyone holding vintage or chase packs, selling sealed singles, or running livestream breaks where packs are shown on camera before they are opened.",
      "For packs that need more than a soft layer, the sleeve can go inside a booster pack top loader for rigid protection in storage or the post. Bigger packs, such as some Japanese or speciality products, may not fit the 73 × 120 mm size, so check your pack before buying for anything outside the standard format.",
    ],
    highlights: [
      "50 sleeves per pack",
      "Extra thick 100 micron polypropylene",
      "73 × 120 mm with a tapered resealable lip",
      "Fits most standard packs of around 10 cards",
      "Acid free and PVC free, high clarity",
      "Pairs with booster pack top loaders",
    ],
    specs: [
      { label: "Pack size", value: "50 sleeves" },
      { label: "Material", value: "Polypropylene, 100 micron" },
      { label: "Sleeve size", value: "73 × 120 mm plus resealable lip" },
      { label: "Fits", value: "Most standard booster packs (around 10 cards)" },
      { label: "Closure", value: "Tapered resealable lip" },
      { label: "Archival", value: "Acid free, PVC free" },
    ],
  },
  // Source: https://otakumart.co.nz/products/mint-fit-toploader-sleeves-35pt-100pc-palms-off
  "MF-IN-ST": {
    metaDescription: "Palms Off Gaming Mint Fit Inner Sleeves, standard size: snug-fitting inner sleeves for double-sleeving Pokémon, Magic and One Piece cards in Australia.",
    intro: "Mint Fit Inner Sleeves are the first layer of a double-sleeve for standard-size cards. They are cut close to the card, so it cannot slide around inside, and they are thin enough to go into a normal deck sleeve or over sleeve on top. Mint Fit is part of Palms Off Gaming's Collector's Series, the brand's line of storage products made with collectors in mind.",
    details: [
      "The point of an inner sleeve is fit. A card that moves inside its sleeve rubs its edges and corners every time the deck is shuffled, which is exactly the wear double-sleeving is meant to stop. A snug inner keeps the card still, and the outer sleeve then takes all of the handling. The result is a card that stays sealed against dust, spills and finger oils for as long as the deck is in use.",
      "To double-sleeve, slide the card into the inner sleeve head first, then turn the sleeved card over so the inner sleeve's opening goes into the outer sleeve first. That puts the two openings at opposite ends. Palms Off Premium Over Sleeves and Blackout Deck Sleeves in standard size are both suitable outers. Standard size covers English and Japanese Pokémon, Magic, One Piece, Lorcana and Dragon Ball.",
      "Pick the top-loading inner if you are happy flipping each card as you sleeve it. If you would rather not think about it, the side-loading Mint Fit inner (MF-SLIN-ST) opens on the long edge, so the seal happens automatically. For Yu-Gi-Oh! cards, use the Japanese size (MF-IN-JPN).",
    ],
    highlights: [
      "Snug inner sleeve for double-sleeving",
      "Standard size: Pokémon, Magic, One Piece, Lorcana",
      "Thin enough to fit inside a normal deck sleeve",
      "Load inverted into the outer sleeve to seal the card",
      "Part of the Palms Off Collector's Series",
    ],
    specs: [
      { label: "Fits", value: "Standard-size cards (63 × 88 mm): Pokémon (English and Japanese), Magic, One Piece, Lorcana, Dragon Ball, sports cards" },
      { label: "Opening", value: "Top-loading" },
      { label: "Use", value: "Inner sleeve for double-sleeving" },
    ],
  },
  // Source: https://otakumart.co.nz/products/mint-fit-toploader-sleeves-35pt-100pc-palms-off
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "MF-IN-JPN": {
    metaDescription: "Palms Off Gaming Mint Fit Inner Sleeves, Japanese mini size: snug inner sleeves for double-sleeving Yu-Gi-Oh! and other small cards. Sold in Australia.",
    intro: "Mint Fit Inner Sleeves in Japanese mini size hold a Yu-Gi-Oh! card tightly, ready to go into an outer sleeve. Small cards have very little margin for error: a standard inner sleeve leaves several millimetres of slack around a mini card, and the card slides around inside. This size is cut for the smaller format, so the double-sleeved card stays put and the deck stays square.",
    details: [
      "Double-sleeving a Yu-Gi-Oh! deck is common for anyone running expensive staples or prized rarities. The inner sleeve holds the card and never gets handled; the outer sleeve takes every shuffle. With mini cards that only works if both layers are the right size, because a loose inner makes the outer sleeve bulge and the deck harder to shuffle without bending cards.",
      "Sleeve the card head first into the inner, then put it into the outer sleeve bottom first, so the inner's opening ends up at the closed end of the outer sleeve. Palms Off Premium Over Sleeves and Blackout Deck Sleeves in Japanese mini size are suitable outers. Remember that Japanese-language Pokémon and One Piece cards are standard size, so they need the standard Mint Fit inner (MF-IN-ST) instead.",
      "If flipping every card as you sleeve a 40-card deck sounds tedious, look at the side-loading Japanese inner (MF-SLIN-JPN), which opens on the side and seals automatically inside a top-loading outer. Keep spare inners in the deck box, so a sleeve that splits during an event can be swapped without unsleeving the rest.",
    ],
    highlights: [
      "Snug inner sleeve for Japanese mini cards",
      "Cut for Yu-Gi-Oh! so the card cannot slide",
      "Fits inside Japanese-size deck and over sleeves",
      "Load inverted into the outer sleeve to seal the card",
      "Part of the Palms Off Collector's Series",
    ],
    specs: [
      { label: "Fits", value: "Japanese-size cards such as Yu-Gi-Oh! (59 × 86 mm)" },
      { label: "Opening", value: "Top-loading" },
      { label: "Use", value: "Inner sleeve for double-sleeving" },
    ],
  },
  // Source: https://otakumart.co.nz/products/mint-fit-toploader-sleeves-35pt-100pc-palms-off
  "MF-SLIN-ST": {
    metaDescription: "Palms Off Gaming Mint Fit Side-Loading Inner Sleeves, standard size: seal Pokémon, Magic and One Piece cards when double-sleeving. Stocked in Australia.",
    intro: "Mint Fit Side-Loading Inner Sleeves open along the long edge instead of the top. Slide a standard-size card in from the side, drop it into a normal top-loading outer sleeve, and the two openings cross at right angles. The card is closed on all four edges without having to remember to flip the inner sleeve, which makes sleeving a whole deck quicker and less error-prone.",
    details: [
      "With a top-loading inner, every card needs to go into the outer sleeve upside down, and one card loaded the wrong way leaves an open path for dust or a spilt drink. A side-loading inner removes that step. The inner's opening faces sideways no matter which way the card goes into the outer sleeve, so a 60-card Pokémon deck or a 100-card Commander deck is sealed card by card.",
      "Side loaders also hold the card more securely during shuffling. Because the opening is on the long edge, a riffle or mash shuffle pushes the card against a closed end rather than towards the opening, so it is less likely to creep out. Use a standard-size outer such as Palms Off Premium Over Sleeves or Blackout Deck Sleeves. Standard size fits English and Japanese Pokémon, Magic, One Piece, Lorcana and Dragon Ball.",
      "Choose side-loading over the top-loading Mint Fit inner (MF-IN-ST) for any deck you sleeve in bulk or for cards you want sealed with no margin for error. The top-loading version suits players who already have a habit of flipping inners. For Yu-Gi-Oh! cards, use the Japanese side-loading inner (MF-SLIN-JPN).",
    ],
    highlights: [
      "Opens on the long edge, not the top",
      "Seals automatically inside a top-loading outer sleeve",
      "Standard size: Pokémon, Magic, One Piece, Lorcana",
      "Card is less likely to creep out during shuffling",
      "Part of the Palms Off Collector's Series",
    ],
    specs: [
      { label: "Fits", value: "Standard-size cards (63 × 88 mm): Pokémon (English and Japanese), Magic, One Piece, Lorcana, Dragon Ball, sports cards" },
      { label: "Opening", value: "Side-loading (long edge)" },
      { label: "Use", value: "Inner sleeve for double-sleeving" },
    ],
  },
  // Source: https://otakumart.co.nz/products/mint-fit-toploader-sleeves-35pt-100pc-palms-off
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "MF-SLIN-JPN": {
    metaDescription: "Palms Off Gaming Mint Fit Side-Loading Inner Sleeves, Japanese mini size: seal Yu-Gi-Oh! cards automatically when double-sleeving. Sold in Australia.",
    intro: "This is the side-loading Mint Fit inner sleeve in Japanese mini size, for Yu-Gi-Oh! players who double-sleeve. The card goes in from the long edge, then into any top-loading Japanese-size outer sleeve. Because the openings meet at right angles, the card is sealed whichever way round it goes in, and small cards, where a few millimetres of slack shows quickly, stay snug and square in the deck.",
    details: [
      "Double-sleeving 40 to 60 mini cards with top-loading inners means flipping each one before it goes into the outer sleeve, and it only takes one card loaded the same way round to leave a gap. Side-loading inners remove that risk. They are also kinder to small cards during play: shuffling pushes the card toward a closed edge rather than the opening, so it stays seated.",
      "Pair these with Japanese-size outers such as Palms Off Premium Over Sleeves (clear or matte) or Blackout Deck Sleeves. The combination keeps out dust, table grime and spills, which matters for high-value Yu-Gi-Oh! cards that still get played at locals. Japanese-language Pokémon and One Piece cards are standard size and need the standard side-loading inner (MF-SLIN-ST).",
      "Pick side-loading over the top-loading Japanese Mint Fit inner (MF-IN-JPN) if you sleeve decks in batches or want a seal that does not depend on loading direction. When re-sleeving, keep the inner sleeves on and only swap the outers; the inner rarely wears, since it never touches the table.",
    ],
    highlights: [
      "Side opening for Japanese mini cards",
      "Seals automatically inside a top-loading outer",
      "Cut for Yu-Gi-Oh! so the card sits snug",
      "Card stays seated during shuffling",
      "Part of the Palms Off Collector's Series",
    ],
    specs: [
      { label: "Fits", value: "Japanese-size cards such as Yu-Gi-Oh! (59 × 86 mm)" },
      { label: "Opening", value: "Side-loading (long edge)" },
      { label: "Use", value: "Inner sleeve for double-sleeving" },
    ],
  },
  // Source: https://www.whatnot.com/fr-FR/listing/TGlzdGluZ05vZGU6MTgyNTI0OTQ2OA==
  // Source: https://www.ebay.de/itm/177166637670
  "SCS-ST": {
    metaDescription: "Palms Off Gaming Soft Card Sleeves, standard size: 100 acid-free, PVC-free penny sleeves for Pokémon, sports and TCG cards. Stocked in Australia.",
    intro: "Soft Card Sleeves are Palms Off Gaming's penny sleeve for standard-size cards: 100 clear polypropylene sleeves per pack, acid-free and PVC-free, measuring 65 × 91 mm. They are the first thing a good card should go into after it leaves the pack, and the layer that stops its surface rubbing on a top loader, binder pocket or the inside of a storage box.",
    details: [
      "Most surface scratches on cards happen in the seconds after they are pulled, when a bare card is pushed into a top loader or slid across a table. A soft sleeve prevents that. Slide the card in head first, with the opening at the top, and from then on everything else touches the sleeve rather than the card. Because the film is clear polypropylene with no PVC, it is suitable for long-term storage and will not leach anything onto the print.",
      "Use them as the base layer for a 35pt top loader, inside binder pages, in bulk storage boxes, or as a quick cover for cards you are listing or trading. They also suit grading submissions where the card travels sleeved inside a semi-rigid holder; check your grading company's current packing rules before you send. One pack is rarely enough once you start sorting a collection.",
      "Standard size fits English and Japanese Pokémon, Magic, One Piece, Lorcana, Dragon Ball and standard sports cards. If you are protecting Yu-Gi-Oh! cards, buy the Japanese mini version (SCS-JPN), which holds the smaller card without slack. For cards that will be shuffled in a deck, a deck sleeve such as Blackout is the better choice, since penny sleeves are made for protection rather than play.",
    ],
    highlights: [
      "100 sleeves per pack",
      "Acid-free, PVC-free clear polypropylene",
      "65 × 91 mm, for standard 35pt cards",
      "First layer before a top loader, binder or box",
      "Archival safe for long-term storage",
    ],
    specs: [
      { label: "Fits", value: "Standard-size 35pt cards (63 × 88 mm)" },
      { label: "Pack size", value: "100 sleeves" },
      { label: "Sleeve size", value: "65 × 91 mm" },
      { label: "Material", value: "Clear polypropylene, acid-free, PVC-free, archival safe" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-soft-card-sleeves-japanese-mini-size-100pc-clear-110178730/
  "SCS-JPN": {
    metaDescription: "Palms Off Gaming Soft Card Sleeves, Japanese mini size: 100 clear 50 micron acid-free, PVC-free penny sleeves for Yu-Gi-Oh! cards. Sold in Australia.",
    intro: "These are penny sleeves made for Japanese mini cards like Yu-Gi-Oh!, in packs of 100. The film is high-clarity 50 micron polypropylene, acid-free, PVC-free and archival safe, so a card can stay in one for years. Sized for the smaller format, they hold the card without the slack a standard penny sleeve leaves, which is what lets it slide and pick up edge wear.",
    details: [
      "A loose sleeve is only half a sleeve. When a 59 × 86 mm Yu-Gi-Oh! card sits in a sleeve made for 63 × 88 mm cards, it shifts every time the sleeve moves, and its corners end up doing the work the sleeve should. The mini cut keeps the card still, so it can go into a small top loader, a binder pocket or a storage box with its surface and edges protected.",
      "Be careful with the size. These sleeves are for Japanese mini cards only. Japanese-language Pokémon, One Piece, Dragon Ball and Magic cards are printed at standard size and will not fit; they need the standard Soft Card Sleeves (SCS-ST). The sleeves suit bulk storage, binder collections and grading submissions, where a card usually travels in a soft sleeve inside a semi-rigid holder. Check your grader's current guidance first.",
      "Use these as protection rather than for play. For a Yu-Gi-Oh! deck you will shuffle, a deck sleeve such as the Japanese Blackout sleeve is thicker and opaque-backed. For storage, load the card head first, keep sleeved cards out of direct sun, and stack them upright in a box so they are not pressed flat under weight.",
    ],
    highlights: [
      "100 sleeves per pack",
      "High-clarity 50 micron polypropylene",
      "Acid-free, PVC-free and archival safe",
      "For Japanese mini cards such as Yu-Gi-Oh! only",
      "Suits storage, binders and grading submissions",
    ],
    specs: [
      { label: "Fits", value: "Japanese mini cards such as Yu-Gi-Oh! (59 × 86 mm); not Japanese Pokémon or other standard cards" },
      { label: "Pack size", value: "100 sleeves" },
      { label: "Thickness", value: "50 micron" },
      { label: "Material", value: "High-clarity polypropylene, acid-free, PVC-free, archival safe" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-command-case-10-pack-110202616/
  "CMD-10": {
    metaDescription: "Palms Off Gaming Command Case 10 pack: two-piece sliding acrylic cases with UV resistance for your Commander or leader card. Stackable, sold in Australia.",
    intro: "The Command Case is a single-card acrylic case made for the one card that stays on the table all game: your Magic commander, Star Wars: Unlimited leader or a similar showcase card. This pack has ten of them. Each is two pieces that slide together and lock in place, so the case does not pop open mid-game, and it holds a standard-size card that is already in an inner sleeve.",
    details: [
      "Commanders and leaders get handled more than any other card in a deck. They come out of the box first, sit face up beside the playmat and get picked up every time someone reads them. A clear case keeps that card visible and protected, with strong UV resistance and splash protection against a knocked-over drink at a games night.",
      "The sliding closure is the design choice that matters during play. Magnetic or snap cases can pop open if they are dropped or flipped, while this one stays shut until you slide it apart. The cases are stackable, so several can be kept together neatly, and they are compatible with the Palms Off Gaming Portal Deck Box, sold separately.",
      "Ten cases cover a whole playgroup, a rotation of Commander decks, or a set of display cards on a shelf. Put the card in a tight-fitting inner sleeve before casing it. For a raw collectible card intended for display only, a magnetic one-touch is the alternative. Wipe the acrylic with a microfibre cloth to keep the card easy to read across the table.",
    ],
    highlights: [
      "10 single-card acrylic cases",
      "Two-piece sliding closure that will not pop open in play",
      "Strong UV resistance, high clarity and splash protection",
      "Fits a standard card in an inner sleeve",
      "Stackable; compatible with the Portal Deck Box",
    ],
    specs: [
      { label: "Pack quantity", value: "10 cases" },
      { label: "Material", value: "Acrylic" },
      { label: "Closure", value: "Two-piece sliding" },
      { label: "Fits", value: "One standard-size card, inner-sleeved" },
      { label: "Protection", value: "UV resistant, splash protection" },
    ],
  },
  // Source: https://otakumart.co.nz/products/genesis-deck-box-blue-palms-off
  // Source: https://otakumart.co.nz/products/genesis-deck-box-red-palms-off
  // Source: https://www.kmart.com.au/product/palms-off-gaming-genesis-deck-box-black-110128721/
  "DB-G": {
    metaDescription: "Palms Off Gaming Genesis Deck Box: holds 100 double-sleeved or 120 single-sleeved cards, with buckle and magnetic lid. Seven colours, sold in Australia.",
    intro: "The Genesis is a deck box built for decks that actually get played. It takes up to 100 double-sleeved or 120 single-sleeved standard cards, enough for a Commander deck or a Pokémon, One Piece or Digimon deck with sideboard room. An impact-resistant Nitracore internal structure protects the cards inside, a magnetic lid closes it, and a quick-link buckle stops it opening in your bag. Seven colours.",
    details: [
      "A deck box gets thrown into a backpack, dropped on the floor at a tournament and opened dozens of times a month. The Genesis answers that with two closures working together: magnets that keep the lid shut and a buckle as a second lock. The reinforced inner structure is there so a knock to the outside does not bend the cards inside.",
      "The capacity suits standard-size card games: Pokémon, Magic: The Gathering, One Piece, Lorcana, Digimon and Dragon Ball Super. At 100 double-sleeved cards it holds a 99-card Commander deck plus its commander in two layers of sleeves, or a 60-card deck with tokens, damage counters and spare sleeves. Single-sleevers get extra room up to 120 cards. Japanese-size cards will have more space to move around.",
      "Choose the Genesis over the Portal Nexus 100 if a buckle closure suits the way you carry your gear. Seven colours make it easy to tell decks apart at a glance, which matters when you own several. The Genesis was first released in January 2024, so it has been through plenty of tournament seasons in players' bags.",
    ],
    highlights: [
      "Holds 100 double-sleeved or 120 single-sleeved cards",
      "Impact-resistant Nitracore internal structure",
      "Magnetic lid plus quick-link buckle",
      "For Pokémon, Magic, One Piece, Lorcana and Digimon decks",
      "Seven colours",
    ],
    specs: [
      { label: "Capacity", value: "100 double-sleeved or 120 single-sleeved standard cards" },
      { label: "Closure", value: "Magnetic lid with quick-link buckle" },
      { label: "Internal structure", value: "Nitracore, impact resistant" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-command-case-10-pack-110202616/
  "PTL-N100": {
    metaDescription: "Palms Off Gaming Portal Deck Box Nexus 100 in blue: a deck box for sleeved, playable decks that works with Palms Off Command Cases. Available in Australia.",
    intro: "The Portal Nexus 100 is the second deck box design from Palms Off Gaming, and the one that ties into the brand's Command Case. The single-card acrylic Command Case is listed as compatible with the Portal Deck Box, so a commander or leader can travel protected alongside the deck. It is a box for sleeved decks that get carried to games regularly, offered here in blue.",
    details: [
      "What separates the Portal from the Genesis is its design rather than its purpose. Both are made for playable, sleeved decks; the Portal is the one to choose if you already use Command Cases or want your commander kept in its own case rather than loose in the box. Compare the product photos to see the closure and profile, since that is what you will handle every time you open it.",
      "It suits standard-size card games such as Magic: The Gathering in the Commander format, Star Wars: Unlimited, Pokémon, One Piece and Lorcana. Players who double-sleeve should check the fit with their own sleeves, as thicker premium sleeves take up more room than thin ones.",
      "A common set-up is a deck in matte sleeves, the commander or leader in a Command Case, and the whole lot in the Portal. If you want a buckle closure and a stated 100 double-sleeved capacity instead, the Genesis is the sibling to look at. Store the box away from heat, such as a car dashboard in an Australian summer, which is hard on both sleeves and cards.",
    ],
    highlights: [
      "Deck box for sleeved, playable decks",
      "Works with the Palms Off Command Case",
      "Suits Commander and leader-based formats",
      "A different design and closure to the Genesis",
      "Blue",
    ],
  },
  "PM-ST": {
    metaDescription: "Palms Off Gaming playmat with a rubber backing that stays put on the table. A plain colour surface for play, trading and photos, in eight colours.",
    intro: "A playmat is the one accessory that touches every card in a game. This Palms Off Gaming mat gives sleeved cards a surface they can be picked up from without scraping across a bare table, and the rubber backing grips so the mat does not slide mid-game. It comes in eight plain colours, from Black and Jade to Pink and Yellow, so there is one for every deck box.",
    details: [
      "Plain colour mats have a practical side beyond looks. With no printed art, cards stand out clearly against the surface, which makes the board state easier to read across the table in Pokémon, Magic, One Piece or Lorcana. It also means nothing distracts from the cards when the mat is used as a photography background.",
      "That background use is worth thinking about if you sell cards. A flat, single-colour surface removes clutter and gives consistent listing photos. Darker colours such as Black or Purple make holo and foil cards pop, while lighter ones like Yellow or Turquoise suit darker card borders. Some sellers keep two colours for that reason, and swap between them depending on the card being shot.",
      "To keep a mat in good shape, roll it with the playing surface facing outward rather than folding it, which avoids creases. Wipe up spills promptly and let it dry flat before rolling it again. Store it rolled in a tube or flat under something light, away from direct sun, so the colour stays even. A mat that is cared for this way lasts for years of weekly play.",
    ],
    highlights: [
      "Rubber backing keeps the mat in place",
      "Protects sleeves from rough table surfaces",
      "Plain colour surface for a clear board and clean photos",
      "Eight colours: Black, Blue, Jade, Pink, Purple, Red, Turquoise, Yellow",
      "Roll rather than fold to avoid creases",
    ],
    specs: [
      { label: "Backing", value: "Rubber" },
    ],
  },
  // Source: https://pcvarge.com/listing/11089508243
  "TEAM-100": {
    metaDescription: "Palms Off Gaming team bags: 100 resealable, ultra-clear polypropylene bags that hold up to six 35pt top loaders, a team set, or sleeved cards.",
    intro: "Team bags are the resealable outer layer of card storage. This 100-pack from Palms Off Gaming is made from ultra-clear polypropylene that is acid free and PVC free, with a resealable lip. Each bag holds a single loaded card for posting, up to six standard 35pt (3 × 4 inch) top loaders together, or a small stack of cards in soft sleeves, such as a completed team set.",
    details: [
      "The classic use is the last layer before a card goes into a mailer. Slide a top loader into a team bag and seal the lip, and the loader's open end is closed off so the card cannot slip out in transit. Dust and moisture are kept out too, which matters for cards sitting in a post office tray or a wet letterbox.",
      "The bags are also generous enough to group cards. Up to six 35pt top loaders fit in one, so a small lot or a buyer's whole order can travel as a single unit. Sports collectors use them for team sets in penny sleeves, and TCG players use them for a playset or a trade bundle that needs to stay together.",
      "Because the film is ultra clear, you can write a label or slip a note inside without anything adhesive touching the cards or loaders. For storage, file bagged loaders upright in a box so they do not press on each other. Re-seal the lip after each use, and replace a bag once the adhesive stops holding.",
    ],
    highlights: [
      "100 bags per pack",
      "Holds up to six 35pt (3 × 4 inch) top loaders",
      "Resealable lip closes the loader's open end",
      "Ultra-clear polypropylene, acid free and PVC free",
      "For posting, team sets and trade bundles",
    ],
    specs: [
      { label: "Pack size", value: "100 bags" },
      { label: "Capacity", value: "Up to 6 × 35pt (3 × 4 inch) top loaders" },
      { label: "Material", value: "Ultra-clear polypropylene" },
      { label: "Closure", value: "Resealable lip" },
      { label: "Archival", value: "Acid free, PVC free" },
    ],
  },
  // Source: https://groovy.tcgsync.com/products/tag-sleeves-100pc
  "TAG-100": {
    metaDescription: "Palms Off Gaming Tag Sleeves: 100 soft sleeves with a broad, rounded pull tab for sliding cards out of top loaders. 60 micron, PVC free, in a tray.",
    intro: "Getting a card out of a top loader is fiddly, and digging at it is how corners get dinged. Tag Sleeves fix that. Each soft sleeve has a broad, round-edged tab at the top, so you pull on the tab rather than the card. The pack holds 100 sleeves in 60 micron PVC-free plastic, stacked in a tray, and replaces the sticky-note tabs many collectors use for grading submissions.",
    details: [
      "Collectors have long stuck a small tab of tape or a sticky note onto a penny sleeve so it can be drawn out of a loader or semi-rigid holder. That works, but adhesive can shift or leave residue. A Tag Sleeve builds the tab into the sleeve itself, with no adhesive involved, so the pull point is always in the same place.",
      "The tab is wide and has rounded edges, which spreads the pull across the top of the sleeve rather than concentrating it at one spot. The sleeve keeps its shape as it slides out, so the card comes with it instead of being left behind or bent. At 60 micron, the film is firm enough to hold that shape while staying soft against the card surface.",
      "These suit anyone who loads and unloads cards often: preparing a grading submission, swapping cards in and out of a trade binder, or checking condition before a sale. Keep unused sleeves in the supplied tray so the tabs stay flat. For a final outer layer on a loaded card, add a Mint Fit top loader sleeve or a team bag.",
    ],
    highlights: [
      "100 sleeves per pack",
      "Broad, round-edged pull tab built into each sleeve",
      "Draws cards out of top loaders without digging",
      "60 micron PVC-free plastic",
      "No adhesive tabs needed for grading prep",
      "Supplied in a tray",
    ],
    specs: [
      { label: "Pack size", value: "100 sleeves" },
      { label: "Material", value: "PVC-free plastic, 60 micron" },
      { label: "Feature", value: "Broad, round-edged pull tab" },
      { label: "Packaging", value: "Storage tray" },
    ],
  },
  "STS-100": {
    metaDescription: "Palms Off Gaming serialised tamper seals: numbered, tamper-evident seals on a roll for sealed boxes, break product, consignment and posted trades.",
    intro: "A tamper seal answers one question for a buyer: has this been opened since it was sealed? These Palms Off Gaming seals carry an individual serial number each and show visible damage if anyone peels them off. That lets a seller prove a box, case or graded order went out untouched, and lets a buyer check it on arrival. They come on a roll for quick application.",
    details: [
      "The serial number is what lifts these above plain sticker seals. Recording the number on an invoice, a listing or a video before posting creates a record that links the seal to that exact item. If a dispute comes up, the number on the parcel either matches or it does not, and a damaged seal is obvious at a glance.",
      "Typical uses in the card hobby include sealing booster boxes and cases for resale, closing up product set aside for a livestream break, and sealing consignment items while they are held for someone else. Shops also use them on lots of loose packs or sealed bundles so customers know nothing has been swapped.",
      "Apply each seal across a seam or opening so it cannot be lifted without breaking, onto a clean, dry surface for best adhesion. Keep the roll somewhere cool and dry so the adhesive stays reliable. It is good practice to photograph the seal and its number before the item leaves your hands, and to keep that photo with the order record until the sale is complete.",
    ],
    highlights: [
      "Each seal carries its own serial number",
      "Tamper evident: removal leaves visible damage",
      "For sealed boxes, breaks, consignment and posted trades",
      "Supplied on a roll",
      "Record numbers on invoices or listings for a clear audit trail",
    ],
    specs: [
      { label: "Format", value: "Roll" },
      { label: "Numbering", value: "Individually serialised" },
    ],
  },
};
