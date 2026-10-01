/**
 * Researched long-form copy and verified extra spec rows for the Palms Off
 * Gaming binders, keyed by SKU and merged onto BINDER_PRODUCTS. Specs here are
 * limited to facts confirmed against a published listing for that exact binder
 * (sources noted per entry). Keep dependency-free: api/prerender.js imports it.
 */

export const BINDER_PRODUCT_COPY = {
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collector's-series-4-pocket-zip-binder-yellow-110062593/
  // Source: https://cardbot.com.au/products/palms-off-gaming-collectors-series-4-pocket-zip-trading-card-binder
  // Source: https://www.jbhifi.co.nz/products/trading-card-accessories-palms-off-collectors-series-4-pocket-zip-binder-black
  "ZB-04": {
    details: [
      "The 4-pocket Collector's Series binder holds 20 side-loading pages, giving 160 card slots in total. That is a modest number on paper, but it is deliberate: each pocket gets a quarter of the page, so a single card is shown at its full size with clear space around it. For a binder built around showing cards rather than storing them, that is the trade worth making.",
      "Cards go in bare, in a penny sleeve or in a perfect-fit inner sleeve. A collector who double-sleeves everything will find the binder fills out towards the spine, so keep the heaviest-sleeved cards spread across pages rather than stacked on the same spread. Leave the four pockets nearest the spine for your least valuable cards if you plan to open the binder often.",
      "Choose this over the 9- or 12-pocket versions if the binder is a showcase: a favourite artist's run, a set of illustration rares, a personal collection you hand to friends. If your cards already live in top loaders, the 4-pocket top loader binder is the better match. Store it upright on a shelf like a book, with the zip closed, rather than lying under other binders, which presses the pages and can leave pocket outlines on the cards.",
    ],
    specs: [
      { label: "Pages", value: "20 side-loading pages" },
      { label: "Capacity", value: "160 cards" },
      { label: "Exterior", value: "Water-resistant textured PU leather" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collector's-series-9-pocket-zip-binder-black-110062620/
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collector's-series-9-pocket-zip-binder-purple-110062588/
  // Source: https://www.jbhifi.co.nz/products/trading-card-accessories-palms-off-collectors-series-9-pocket-zip-binder-black
  "ZB-09": {
    details: [
      "Twenty side-loading pages at nine pockets each gives this binder 360 card slots. That is enough for most modern Pokémon main sets with their secret rares, a large One Piece or Lorcana set, or a complete base set of a sports release, with room to keep the pages in numerical order from the first card to the last.",
      "The pockets take a bare card, a penny-sleeved card or a perfect-fit inner sleeve without fuss. Double-sleeved cards in thicker deck sleeves will fit but use more depth, so a binder full of them sits fatter at the spine and the zip works a little harder. If you plan to fill every pocket with double-sleeved cards, consider a second binder rather than forcing one.",
      "This is the binder to pick when the aim is a tidy, readable collection. The 4-pocket version shows fewer cards at a larger scale, and the 12-pocket fits more in at the cost of breathing room. Against the Stealth 9-pocket, this one has the textured cover and the Collector's Series branding; the Stealth is smooth and plain. Keep it upright when stored, away from heat and direct sun, and wipe the water-resistant exterior with a dry cloth if it gets dusty.",
    ],
    specs: [
      { label: "Pages", value: "20 side-loading pages" },
      { label: "Capacity", value: "360 cards" },
      { label: "Exterior", value: "Water-resistant textured PU leather" },
    ],
  },
  // Source: https://groovy.tcgsync.com/products/palms-off-12-pocket-red-binder
  // Source: https://groovy.tcgsync.com/products/collectors-series-12-pocket-zip-trading-card-binder-pink
  // Source: https://www.jbhifi.co.nz/products/trading-card-accessories-palms-off-collectors-series-12-pocket-zip-binder-black
  "ZB-12": {
    details: [
      "The 12-pocket Collector's Series binder has 20 side-loading pages and 480 card slots, the largest capacity of any binder in the range. Each pocket measures 68 × 95 mm. A standard card is 63 × 88 mm, so the pocket leaves a few millimetres of play, which is taken up neatly by a soft penny sleeve and stops the card shifting inside the pocket.",
      "Because the pockets are sized with a soft sleeve in mind, this binder is happiest with cards that are bare or in a single thin sleeve. Thick deck sleeves and double-sleeved cards are a tighter fit, and twelve of them on one page add up quickly. If most of your cards are double-sleeved, the 9-pocket version gives more room per card.",
      "Pick this one when the problem is quantity: large modern sets with hundreds of cards, bulk rares, or trade stock you want sorted and portable. Against the Stealth 12-pocket, it offers the textured Collector's Series cover in all eight colours rather than a plain smooth finish. A binder this full is heavy, so store it upright and supported, not leaning, and avoid stacking other binders on top, which can press the pockets onto the cards.",
    ],
    specs: [
      { label: "Pages", value: "20 side-loading pages" },
      { label: "Capacity", value: "480 cards" },
      { label: "Pocket size", value: "68 × 95 mm" },
      { label: "Exterior", value: "Water-resistant textured PU leather" },
    ],
  },
  "TOP-04": {
    details: [
      "The four-to-a-page layout gives each loaded card a large window, which suits cards that are worth looking at closely: high-grade raws being considered for submission, signed cards, or chase cards you show to people at a table. Four loaders per page also makes it easy to arrange a page as a small display, such as a four-card evolution line or one player's rookie and inserts.",
      "Loaders go in exactly as they are. A card in a penny sleeve inside a standard 35pt loader is the intended fit. Cards in thicker loaders, such as 55pt or 75pt holders for heavier stock, will not seat properly, so keep those in mag lock cases or a storage box instead. If a loader is scuffed or dusty, wipe it before filing, since anything trapped on its face will sit against the pocket.",
      "Pick this over the 9-pocket top loader binder when presentation matters more than capacity, and over the plain 4-pocket binder when your best cards already live in loaders and you do not want to take them out. To look after it, avoid overloading pockets with two loaders, keep the zip fully closed in transit, and store the binder upright so the weight of the loaders does not rest on the pages below.",
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collectors-series-9-pocket-top-loader-216-capacity-zip-binder---purple-110062570/
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collector's-series-9-pocket-top-loader-216-capacity-zip-binder-blue-110062592/
  // Source: https://www.kmart.com.au/product/palms-off-gaming-collector's-series-top-loader-9-pocket-zip-binder-black-110095136/
  "TOP-09": {
    details: [
      "This binder has 12 double-sided pages in a three-by-three layout, giving room for 216 standard 35pt top loaders. That is a very different number to the 360 cards a regular 9-pocket binder holds, because each pocket here is sized for a rigid loader rather than a bare card, and each page has to carry that extra depth.",
      "The pockets load from the side and are cut for standard 3 × 4 inch, 35pt loaders. Thicker loaders for patch and relic cards will not fit. The steel zip has an O-ring pull, which is easier to grip than a small tab when the binder is full and heavy. It also ships with a colour-matched microfibre cover bag, useful for keeping the cover clean in a backpack or on a shelf.",
      "Choose this when you carry or store a lot of loaded cards: a trade binder for events, a queue of cards waiting on a grading submission, or a run of singles you would rather not handle out of their loaders. The 4-pocket top loader binder shows fewer cards in a larger frame; this one is about capacity. Keep it in its cover bag when stored, upright, and remember that 216 loaders make for a heavy binder, so carry it by the spine rather than by one cover.",
    ],
    specs: [
      { label: "Pages", value: "12 double-sided pages, 3 × 3 layout" },
      { label: "Capacity", value: "216 × 35pt top loaders" },
      { label: "Zip pull", value: "Steel zip with O-ring pull" },
      { label: "Included", value: "Colour-matched microfibre binder cover bag" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-stealth-9-pocket-zip-binder-black-110062558/
  // Source: https://www.kmart.com.au/product/palms-off-gaming-stealth-9-pocket-zip-binder---pink-110095277/
  "STL-09": {
    details: [
      "Inside, the Stealth 9-pocket has 20 side-loading pages and 360 card slots, the same count as the Collector's Series 9-pocket. The pockets are acid free and PVC free, the inside covers are lined with polyester felt, and the zip is steel. The difference is the outside: a smooth, water-resistant PU leather with no exterior logos at all.",
      "That smooth, blank cover is the real reason to pick Stealth. It is designed to take decals, stickers or laser engraving cleanly, so a player can put a team name, a store logo or their own artwork on it. A textured cover would leave a decal sitting on bumps and gaps; this one gives a flat surface for it to bond to.",
      "Choose Stealth over the Collector's Series 9-pocket if you want to customise the binder or simply prefer a plain look. Card fit is the same: bare, penny-sleeved or perfect-fit sleeved cards suit it best, and double-sleeved cards will fill it faster. Wipe the smooth exterior with a soft dry cloth, as it shows fingerprints more than a textured finish, and store it upright out of direct sun so the colour does not fade unevenly.",
    ],
    specs: [
      { label: "Pages", value: "20 side-loading pages" },
      { label: "Capacity", value: "360 cards" },
      { label: "Cover", value: "Smooth water-resistant PU leather, no exterior logos" },
      { label: "Closure", value: "Steel zip" },
      { label: "Inner cover", value: "Polyester felt lining" },
      { label: "Pocket material", value: "Acid-free and PVC-free, archival safe" },
    ],
  },
  // Source: https://www.kmart.com.au/product/palms-off-gaming-stealth-12-pocket-zip-binder-black-110062610/
  // Source: https://www.kmart.com.au/product/palms-off-gaming-stealth-12-pocket-zip-binder-turquoise-multi-110062699/
  "STL-12": {
    details: [
      "The Stealth 12-pocket holds 20 side-loading pages with 480 card slots, matching the capacity of the Collector's Series 12-pocket. The pockets are acid free and PVC free, the inside covers are felt lined, and a steel zip closes it. The outside is smooth, water-resistant PU leather with no logos, built to be a blank canvas for decals or laser engraving.",
      "Twelve pockets to a page suits large sets, bulk and trade stock better than any other layout in the range, and the blank cover makes this a natural choice for a shop or a seller who wants their own branding on their stock binder. Players who label binders by format or deck archetype can do the same with a simple decal.",
      "Pick this over the Stealth 9-pocket when you need capacity, and over the Collector's Series 12-pocket when you want a plain or customised exterior. Bare and single-sleeved cards are the best fit at twelve to a page; double-sleeved cards make for a thick, heavy binder. Fingerprints show more readily on a smooth finish, so wipe it with a dry cloth now and then, and store it upright, out of direct sun.",
    ],
    specs: [
      { label: "Pages", value: "20 side-loading pages" },
      { label: "Capacity", value: "480 cards" },
      { label: "Cover", value: "Smooth water-resistant PU leather, no exterior logos" },
      { label: "Closure", value: "Steel zip" },
      { label: "Inner cover", value: "Polyester felt lining" },
      { label: "Pocket material", value: "Acid-free and PVC-free, archival safe" },
    ],
  },
  "RB-BLK": {
    details: [
      "A ring binder earns its place when a collection is still being worked out. Pages can be pulled, reordered and replaced, so a set can be filed in number order today and by artist or type next month without moving every card. That flexibility is also why it is the binder for graded cards: PSA 4-slot pages let slabs be filed and browsed like any other page.",
      "Graded slabs are heavy compared with raw cards, so plan the binder around that. A few pages of slabs is comfortable; a binder full of them puts real weight on the rings. Mixing slab pages with standard card pages spreads that load and keeps the binder easier to handle. Use pages sized for this binder so the holes line up and pages turn cleanly over the rings.",
      "Choose this over any of the zip binders if you want to file graded cards, mix page layouts, or keep reorganising. Choose a zip binder if you mostly carry the binder around, since bound pages and a full zip are more secure in a bag. Store the ring binder upright with the rings closed, and avoid leaving it open flat for long periods, which can distort the pages nearest the rings.",
    ],
  },
};
