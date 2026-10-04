/**
 * Per-category copy for the Palms Off Gaming products.
 *
 * Keyed by LEAF CATEGORY SLUG from utils/shopCategories.js — these products sit
 * in the shop's normal product-type taxonomy, not a brand section, so the copy
 * is attached to the product type a page belongs to.
 *
 * The catalogue in data/palmsOffCatalogue.js is generated from what is actually
 * in the `palms off gaming products` Storage bucket — titles, SKUs, colours and
 * image paths. This file is the hand-written half: what each category IS, who
 * it is for, and how to choose within it.
 *
 * Category copy is deliberately the unit of writing rather than per-product
 * copy. Within a category the products differ by one dimension — a point
 * rating, a sleeve size, a pack count — so the useful, non-duplicated content
 * is the explanation of that dimension, shown once per category and reused by
 * every product page in it alongside that product's own derived specifics.
 * Per-product paragraphs can be layered on top later without restructuring
 * anything: a product with its own `intro` overrides the category's.
 *
 * Keep this file dependency-free — api/prerender.js and api/sitemap.js import
 * it directly.
 */

export const PALMS_OFF_CATEGORIES = {
  'premium-sleeves': {
    name: 'Premium Sleeves',
    heading: 'Palms Off Gaming Deck Sleeves',
    blurb: 'Blackout deck sleeves and premium over sleeves in standard and Japanese mini sizes.',
    intro:
      'Sleeves are the layer that takes the wear so the card does not. Palms Off Gaming\'s Blackout range is an opaque-backed deck sleeve made for play and for storage — the solid back hides any marking or wear on the sleeve itself from showing through, which is what keeps a sleeved deck legal and a sleeved collection consistent. The Premium Over Sleeves are the outer half of a double-sleeve: they go over an already-sleeved card so the inner sleeve, and the card in it, never touch a table.',
    choosing:
      'Two decisions. **Size** — standard sleeves fit Pokémon, Magic, One Piece, Lorcana and sports cards; Japanese mini sleeves fit Yu-Gi-Oh, which is noticeably smaller. Japanese-language Pokémon cards are standard size, so they take standard sleeves. **Finish** — gloss shuffles faster and shows colour more vividly, matte reduces glare and grips slightly, which most players prefer for long sessions.',
    faqs: [
      { q: 'What is the difference between standard and Japanese mini size?', a: 'Japanese mini (often called Yu-Gi-Oh size) is cut for 59 × 86 mm cards, smaller than the 63 × 88 mm standard, so those cards need their own sleeve size. Yu-Gi-Oh is mini size. Pokémon (English and Japanese), Magic, One Piece, Lorcana and sports cards are standard.' },
      { q: 'Should I choose matte or gloss?', a: 'Matte reduces glare and has slightly more grip, which most players prefer for long sessions and for photographing cards. Gloss shuffles faster and shows colour more vividly. Neither protects better than the other.' },
      { q: 'What is an over sleeve for?', a: 'Double-sleeving. The card goes in an inner sleeve first, then the whole thing goes into an over sleeve. The card is then sealed on all sides and the inner sleeve takes no handling at all — standard practice for anything valuable that still sees play.' },
    ],
  },

  'top-loaders': {
    name: 'Top Loaders',
    heading: 'Palms Off Gaming Top Loaders',
    blurb: 'Rigid top loaders and card loaders from 35pt to 180pt, plus a booster pack size.',
    intro:
      'A top loader is the rigid sleeve that turns a card from something you have to be careful with into something you can post, trade and hand across a table. The card slides in from the top, usually already in a penny sleeve, and the rigid PVC does the rest. Palms Off Gaming make them across the full point range, which matters because a loader that is too big lets the card move and a loader that is too small will not take the card at all.',
    choosing:
      'The point rating is the card\'s **thickness**, not its size. A standard modern card is 35pt. Thicker stock — older cards, patch and relic cards, jersey cards — climbs from there: 55pt, 75pt, 100pt, 130pt, 180pt. If you are not sure, measure the card or start at 35pt for anything modern and standard. The booster pack size takes a sealed pack rather than a single card.',
    faqs: [
      { q: 'What does "pt" mean?', a: 'Point rating is the card\'s thickness in thousandths of an inch. A standard modern trading card is about 35pt. It has nothing to do with the card\'s length or width, which are the same across all of these.' },
      { q: 'Which point size do I need?', a: 'Almost all modern single cards are 35pt. Thick-stock inserts, patch, jersey and relic cards need 55pt and up. Using a loader that is too large lets the card shift around inside, which causes exactly the corner wear the loader is meant to prevent.' },
      { q: 'What is the difference between a top loader and a card loader?', a: 'Both are rigid protectors in the same point sizes. They differ in the loading edge and profile — check the product photos on each page for the shape you want.' },
      { q: 'Do I still need a penny sleeve?', a: 'Yes. A card should always go into a soft sleeve before a top loader — sliding a bare card against rigid PVC is what scuffs the surface and rounds the corners.' },
    ],
  },

  'magnetic-holders': {
    name: 'Magnetic Holders',
    heading: 'Palms Off Gaming Mag Lock Card Cases',
    blurb: 'Magnetic one-touch acrylic cases from 35pt to 180pt.',
    intro:
      'A mag lock case — the "one-touch" — is what a card graduates into when a top loader is no longer enough. Two acrylic halves close on a magnet, holding the card without pressure and without adhesive, and the result is rigid, clear on both faces and openable without tools. It is the standard way to display a card that is staying raw, and the standard way to hand a valuable single across a table without anyone touching it.',
    choosing:
      'Same rule as top loaders: the point rating is the card\'s **thickness**. 35pt covers almost all modern standard cards; thick stock, patch and relic cards need 55pt and up. A case that is too large lets the card rattle, which defeats the point.',
    faqs: [
      { q: 'Are these UV protective?', a: 'Check the individual product page — UV rating varies by case. Regardless of rating, no acrylic case makes a card safe in direct sunlight; keep displayed cards out of it.' },
      { q: 'Can I put a graded card in one?', a: 'No. Graded cards come in their own sealed slab, which is far thicker than any of these. A graded card case is the right product for a slab.' },
      { q: 'Will the magnets damage the card?', a: 'No. The magnets are at the edge of the case, holding the two acrylic halves together — they are not in contact with the card and exert no pressure on it.' },
    ],
  },

  'graded-card-cases': {
    name: 'Graded Card Cases',
    heading: "Palms Off Gaming Collector's Series Graded Card Cases",
    blurb: 'Small, medium and large carry cases sized for graded slabs.',
    intro:
      'Graded slabs are awkward to store and worse to transport: too thick for any binder page, too valuable to stack loose in a box, and heavy enough that a bag of them will chip each other\'s corners. These are hard carry cases built around slab dimensions, so a graded collection travels to a show and back in the same condition it left in.',
    choosing:
      'Size is capacity. Small, medium and large differ in how many slabs each holds — pick by how much of the collection travels at once rather than by how much you own. All three take standard graded slabs.',
    faqs: [
      { q: 'Which grading companies fit?', a: 'These are sized for standard graded slabs, which covers the common PSA, BGS, CGC and ACE formats. Oversized or specialty slabs may not fit.' },
      { q: 'Can I use one for raw cards?', a: 'They are cut for slab dimensions, so a raw card or a card in a top loader will move around inside. For raw cards a storage box or a binder is the better answer.' },
    ],
  },

  'graded-card-protectors': {
    name: 'Graded Card Protectors',
    heading: 'Palms Off Gaming Mint Fit Sleeves',
    blurb: 'Sleeves cut to fit specific holders — PSA and BGS slabs, mag lock cases, top loaders and booster packs.',
    intro:
      'Mint Fit is the range that solves the layer nobody thinks about until something gets scratched: protecting the protector. A graded slab picks up scuffs from being slid in and out of a box. A mag lock case scratches against its neighbours. A top loader rubs. Each Mint Fit sleeve is cut to one specific holder, so it goes on snugly rather than flapping — and the holder, not just the card, stays presentable.',
    choosing:
      'Match the sleeve to the thing you are protecting, not to the card. PSA and BGS slab sleeves come in regular and extra thick; mag lock sleeves are split by the case\'s point range; top loader and booster pack sleeves match those holders. The inner sleeves are the exception — those go directly on the card, in standard or Japanese mini size, top-loading or side-loading.',
    faqs: [
      { q: 'What is the difference between regular and extra thick?', a: 'Extra thick sleeves fit the deeper slabs — thicker cards produce a thicker case. If a regular sleeve will not go on without force, the slab needs the extra thick version.' },
      { q: 'What is a side-loading inner sleeve for?', a: 'The opening is on the side rather than the top. Combined with a top-loading outer sleeve, the two openings sit at right angles, which seals the card completely when double-sleeved.' },
      { q: 'Do slab sleeves affect resale?', a: 'They help. A slab with clean, unscuffed acrylic presents better and photographs better — the sleeve takes the handling marks that would otherwise land on the case.' },
    ],
  },

  'card-savers': {
    name: 'Card Savers',
    heading: 'Palms Off Gaming Semi-Rigid Grading Holders',
    blurb: 'Semi-rigid card holders in 50 and 200 packs — the format grading companies ask for.',
    intro:
      'Semi-rigid holders are what a card travels to a grading company in. They are firmer than a sleeve but flexible enough that a grader can remove the card without tools, which is precisely why submission guidelines ask for them and why a card sent in a rigid top loader can be rejected or delayed. If you are submitting to PSA, BGS, CGC or ACE, this is the holder the card goes in.',
    choosing:
      'Only the pack size differs. A 50 pack suits occasional submissions; 200 is the sensible buy if you submit in bulk or run a store.',
    faqs: [
      { q: 'Why not just send cards in top loaders?', a: 'Grading companies specifically ask for semi-rigid holders. A rigid top loader has to be cut or forced to get the card out, which risks damage and slows the submission — some companies will reject it outright.' },
      { q: 'Do I sleeve the card first?', a: 'Follow the grading company\'s current submission guidelines, since they differ on this and change over time. Check the company\'s own instructions before you send anything.' },
    ],
  },


  'deck-boxes': {
    name: 'Deck Boxes',
    heading: 'Palms Off Gaming Deck Boxes',
    blurb: 'Genesis and Portal deck boxes for sleeved decks.',
    intro:
      'A deck box carries a sleeved, playable deck — which means it has to survive being thrown in a bag every week and still close properly a year later. That is mostly a question of the closure and the hinge, which is where cheap deck boxes fail first. The Genesis and Portal boxes are Palms Off Gaming\'s two takes on that problem.',
    choosing:
      'Capacity first — a deck plus sleeves takes more room than the card count suggests, and double-sleeved decks need noticeably more. Then closure style: check the product photos for the buckle and lid design on each.',
    faqs: [
      { q: 'Will a double-sleeved deck fit?', a: 'Double-sleeving adds real bulk, so check the stated capacity against your deck rather than against the raw card count. A 100-card deck double-sleeved needs meaningfully more room than 100 bare cards.' },
      { q: 'Can I store a deck long term in one?', a: 'Yes, though for cards that are not being played a storage box or binder is easier to sort and search.' },
    ],
  },

  'perfect-fit-sleeves': {
    name: 'Perfect Fit Sleeves',
    heading: 'Palms Off Gaming Mint Fit Inner Sleeves',
    blurb: 'Snug inner sleeves in standard and Japanese mini sizes, top-loading and side-loading.',
    intro:
      'An inner sleeve is the first layer, sized to the card rather than to a sleeve — snug enough that the card does not shift inside it, thin enough that the whole thing still fits into a normal deck sleeve on top. That is what double-sleeving is: an inner sleeve for the fit, an outer sleeve for the handling. For anything valuable that still gets played or shuffled, it is the difference between wear landing on a sleeve and wear landing on the card.',
    choosing:
      'Two decisions. **Size** — standard fits Pokémon, Magic, One Piece, Lorcana and sports cards; Japanese mini fits Yu-Gi-Oh (Japanese Pokémon cards are standard size). **Loading edge** — a side-loading inner sleeve pairs with a top-loading outer sleeve so the two openings sit at right angles, which seals the card completely.',
    faqs: [
      { q: 'Why double-sleeve at all?', a: 'The inner sleeve holds the card snugly and never gets handled; the outer sleeve takes all the shuffling and table contact. Wear ends up on a sleeve you can replace rather than on the card.' },
      { q: 'Which way up does an inner sleeve go?', a: 'Upside down relative to the outer sleeve, so the two openings do not line up. With a side-loading inner sleeve the openings are already at right angles, which achieves the same thing more reliably.' },
      { q: 'Will a double-sleeved card still fit a binder pocket?', a: 'Usually yes, though the binder will sit fuller when every pocket is loaded. A top loader binder is the better choice if most of the collection is double-sleeved.' },
    ],
  },

  'playmats': {
    name: 'Playmats',
    heading: 'Palms Off Gaming Core Playmats',
    blurb: 'Rubber-backed Core Playmats in eight colours.',
    intro:
      'A playmat does two jobs: it gives sleeves a surface they can be picked up from without scraping a table, and it keeps a game area defined. The rubber backing stops the mat sliding mid-game, and the cloth top is what lets you get a fingernail under a card without dragging it across bare wood.',
    choosing: 'These differ only by colour. Eight are available.',
    faqs: [
      { q: 'Can I wash a playmat?', a: 'Spot-clean with a damp cloth and let it air dry flat. Machine washing and heat will separate the cloth from the rubber backing.' },
      { q: 'Does it work for card photography?', a: 'A plain matte mat is a good neutral background and stops cards sliding while you shoot. Darker colours show dust more readily under direct light.' },
    ],
  },

  'penny-sleeves': {
    name: 'Penny Sleeves',
    heading: 'Palms Off Gaming Soft Card Sleeves',
    blurb: 'Penny sleeves in standard and Japanese mini sizes.',
    intro:
      'The penny sleeve is the first and cheapest layer of protection, and the one that does the most work per cent spent. A card in a soft sleeve can go into a top loader, a binder pocket or a storage box without its surface ever touching anything rigid. If you buy one accessory in bulk, it is this.',
    choosing: 'Standard fits Pokémon (English and Japanese), Magic, One Piece, Lorcana and sports cards. Japanese mini fits Yu-Gi-Oh.',
    faqs: [
      { q: 'Are they acid-free?', a: 'Soft sleeves are intended as the contact layer against a card face. Check the product page for the material specification on this line.' },
      { q: 'Which way up does the card go?', a: 'Face down, back of the card toward the sleeve opening, so the front is fully covered. When double-sleeving, the inner sleeve goes on upside down relative to the outer one so the two openings do not line up.' },
    ],
  },

  'team-bags': {
    name: 'Team Bags',
    heading: 'Palms Off Gaming Team Bags',
    blurb: 'Resealable bags sized for a card in a top loader.',
    intro:
      'A team bag is the resealable sleeve that goes around a card already in a top loader. It keeps dust and moisture out, stops the card sliding back out of the loader in transit, and gives you a surface to label. It is the last step before a card goes in a mailer, and the reason a card arrives at a buyer exactly as it was photographed.',
    choosing: 'One size, sized to fit a standard top loader.',
    faqs: [
      { q: 'Do I need one if the card is already in a top loader?', a: 'For posting, yes. A top loader is open at the top — a knock in transit can work the card loose. The bag seals that opening and adds a moisture barrier.' },
    ],
  },

  'tag-sleeves': {
    name: 'Tag Sleeves',
    heading: 'Palms Off Gaming Tag Sleeves',
    blurb: 'Sleeves for labelling and tagging cards in inventory.',
    intro:
      'Tag sleeves let a card carry its own label — price, condition, SKU — without anything adhesive ever touching the card or its holder. For anyone running stock at markets or through a store, that is the difference between an inventory you can price at a glance and one you have to look up.',
    choosing: 'One size.',
    faqs: [
      { q: 'Will the label touch the card?', a: 'No — that is the point. The tag sits in the sleeve alongside or in front of the card, so nothing adhesive contacts the card or its holder.' },
    ],
  },

  'tamper-seals': {
    name: 'Tamper Seals',
    heading: 'Palms Off Gaming Serialised Tamper Seals',
    blurb: 'Numbered tamper-evident seals for sealed product and consignment.',
    intro:
      'A serialised tamper seal makes an opened package obvious and gives the specific item a number that can be quoted in a listing, a receipt or a dispute. For anyone selling sealed product, running breaks, or moving cards on consignment, it converts "trust me" into something a buyer can check — and something you can point at if a claim comes back.',
    choosing: 'Supplied on a roll. Each seal carries its own serial number.',
    faqs: [
      { q: 'What are these actually for?', a: 'Proving a package has not been opened since you sealed it. Common in sealed-product sales, break streaming and consignment, where a buyer needs to know the item is exactly as it was when it left.' },
      { q: 'Can a seal be reused?', a: 'No — that is the mechanism. Removing one damages it visibly and voids the serial, which is what makes tampering evident.' },
    ],
  },

  'storage-boxes': {
    name: 'Storage Boxes',
    heading: 'Palms Off Gaming Command Cases',
    blurb: 'Sliding acrylic cases for displaying a single card.',
    intro:
      'The Command Case is Palms Off Gaming\'s two-piece sliding acrylic case for one sleeved card, such as a Commander or a Star Wars: Unlimited leader, so it can sit on the table during play without being handled.',
    choosing: 'Available individually and as a 10 pack.',
    faqs: [],
  },
};

export const PALMS_OFF_CATEGORY_SLUGS = Object.keys(PALMS_OFF_CATEGORIES);

export const resolvePalmsOffCategory = (slug) =>
  (slug && PALMS_OFF_CATEGORIES[slug] ? { slug, ...PALMS_OFF_CATEGORIES[slug] } : null);
