-- Original long-form descriptions for the CardPop house-brand shop products
-- (SKU CP-*). The previous one-line descriptions were thin enough that Google
-- AdSense flagged the site for "low value content". Paragraphs are separated by
-- a blank line; the first paragraph doubles as the meta description
-- (pages/ProductDetailPage.jsx, api/prerender.js).
--
-- Data-only and idempotent: keyed on SKU, re-running writes the same text.

update public.shop_products set description = $copy$A five-pack of clear acrylic easel stands for propping up cards on a shelf, desk or market table. Built for collectors who show off several cards at once.

Each stand leans a card back at a viewing angle so the artwork faces the room instead of lying flat. They take a raw card, but most collectors stand a card that is already in a penny sleeve and a top loader, or sitting in a magnetic one-touch holder, so the surface is never exposed while it is on show. Line a set of five along a bookshelf to display a Pokémon evolution line, a run of Magic commanders or a rookie class, and swap cards in and out as your collection changes.

Choose the five-pack over the single stand when you are dressing a whole shelf, building a trade-night or card-show table, or rotating favourites through a display cabinet. Having matching stands keeps the row looking tidy, and spares are handy when a new pull deserves a spot. For one hero card, the single stand is enough. If the display sits near a window, pair the stands with our UV-protective magnetic holders, since direct sun fades ink over time, and give the acrylic a wipe with a microfibre cloth to keep it clear.$copy$, updated_at = now()
  where upper(sku) = 'CP-ACRYLIC-STAND-5-PACK';

update public.shop_products set description = $copy$A single clear acrylic easel stand that holds one raw or top-loaded card upright. Made for showing off one standout card on a desk or shelf.

The stand tilts the card back so it can be seen at a glance, and it works with a bare card, a card in a top loader, or one already sealed in a magnetic one-touch holder. For anything valuable, we suggest a penny sleeve and top loader at minimum before it goes on display, so fingers and dust never touch the surface. It is a simple way to give your best pull of the season, a signed card or your current favourite chase card a place of its own beside the monitor or on a bedside table.

Pick the single stand when there is one card you want front and centre, or when you are buying a small gift for a collector. If you are filling a shelf or setting up a stall at a card show, the five-pack gives you matching stands for a row of cards. A UV-protective one-touch holder is a good partner for a card that will sit in the open for months, and a microfibre cloth keeps the acrylic free of fingerprints.$copy$, updated_at = now()
  where upper(sku) = 'CP-ACRYLIC-STAND-SINGLE';

update public.shop_products set description = $copy$A premium D-ring binder with 12-pocket pages that holds up to 480 cards. Suited to collectors filling large sets who want more cards visible per spread.

Twelve pockets per page means each opening shows more of a set at once, so long runs such as a full Pokémon expansion, a Lorcana chapter or a sports base set take fewer page turns to browse. The D-ring design lets pages sit flat and turn cleanly, which reduces stress on the pockets nearest the spine compared with round rings. Sleeve chase cards in perfect fit sleeves before they go in, and keep doubles and bulk in a storage box so the binder stays a curated display of your set.

Choose this binder over the 9-pocket zip binder when capacity and layout matter most: it holds 480 cards against the zip binder's 360, and the 12-pocket grid suits set builders who like seeing big runs at once. The 9-pocket zip binder is the better pick for a binder that travels in a backpack to league nights, because its zip closure keeps cards in if it is dropped. Collectors often run both: this one on the shelf for the master set, the zip binder for the trade folder.$copy$, updated_at = now()
  where upper(sku) = 'CP-BINDER-12-POCKET-PREMIUM';

update public.shop_products set description = $copy$A padded zip-close binder with 20 fixed 9-pocket pages holding 360 cards. Built for players who carry their cards to trade nights and events.

The zip runs around three sides, so nothing slides out if the binder is dropped or tipped upside down in a bag, and the padded cover takes the knocks of being carried around. Because the pages are fixed rather than on rings, there are no metal rings pressing into cards near the spine. The 9-pocket layout is the familiar three-by-three grid used for trade binders across Pokémon, Magic, One Piece and sports, which makes it easy for other collectors to scan your offers at a glance.

Pick this binder over the 12-pocket premium binder when portability and security come first. The fixed pages mean you can't add more, so 360 cards is the limit, which suits a curated trade folder or a single set. If you need room to grow or want a larger grid for a master set, the 12-pocket premium binder holds 480. Put higher-value cards in penny sleeves or perfect fit sleeves before slotting them in, and keep bulk in a storage box so the binder holds only what you want to show or trade.$copy$, updated_at = now()
  where upper(sku) = 'CP-BINDER-9-POCKET-ZIP';

update public.shop_products set description = $copy$A 10-pack of padded bubble mailers for posting single cards and small lots. Sized for casual sellers and traders who send the occasional card.

The usual way to post a raw card is a penny sleeve, then a top loader, then a team bag to keep out moisture, with the bundle sandwiched between two pieces of card or tucked into a rigid cardboard mailer before it goes into the bubble mailer. The padding absorbs bumps through the mail system, while the top loader stops bends. Seal the flap firmly and add a strip of our clear packing tape if you want extra security for the trip through Australia Post.

The 10-pack suits someone who sells or trades now and then: enough for a few marketplace sales or swaps with friends interstate, without a stack of envelopes sitting around for months. If you post cards every week, the 25-pack keeps you stocked for longer and saves restocking trips. For graded slabs or more valuable cards, step up to a rigid cardboard mailer or a small box with padding, since a bubble mailer on its own offers less crush protection than a stiff outer.$copy$, updated_at = now()
  where upper(sku) = 'CP-BUBBLE-MAILERS-10-PACK';

update public.shop_products set description = $copy$A 25-pack of padded bubble mailers for posting trading cards. Made for active sellers and traders who send cards out most weeks.

Each mailer is the outer layer of a standard card-posting setup: card in a penny sleeve, sleeved card in a top loader, top loader in a team bag, then everything sandwiched between cardboard and slipped into the mailer. That layering guards against bends, scuffs and damp during transit. Keeping a stack on hand next to your top loaders, team bags and packing tape turns each sale into a two-minute packing job.

The 25-pack is aimed at people who post regularly, such as CardPop marketplace sellers clearing doubles, breakers sending hits to customers, or traders who run several swaps a month. Buying in this quantity means you are not running out halfway through a weekend of sales. If you only post a card here and there, the 10-pack is plenty. For graded slabs and higher-value cards, a rigid cardboard mailer gives better crush protection than padding alone, so many sellers keep both on the shelf and choose per order.$copy$, updated_at = now()
  where upper(sku) = 'CP-BUBBLE-MAILERS-25-PACK';

update public.shop_products set description = $copy$A 25-pack of Card Saver I semi-rigid holders, the format PSA asks for on grading submissions. Right for collectors sending a small batch for grading.

PSA's shipping guide asks for each card to go into a clear penny sleeve and then a semi-rigid holder, and says not to use top loaders. The reason is practical: a semi-rigid has a lip at the top, so a grader can slide the card out without flexing the holder or touching the surface, whereas a tight top loader can mean prying the card free. The holder is firm enough to stop bends but has enough give that it won't crush corners if pressed. Don't add tape, pull tabs or sticky notes.

The 25-pack matches a typical first or second submission, when you are sending a handful of your best pulls rather than a full bulk order. It also suits collectors who use semi-rigids for storage and want to trial them. If you grade regularly or send bulk orders through a group submission, the 50-pack means you won't run short. Pair these with our penny sleeves, team bags and a rigid cardboard mailer to pack an order the way PSA expects.$copy$, updated_at = now()
  where upper(sku) = 'CP-CARD-SAVERS-25-PACK';

update public.shop_products set description = $copy$A 50-pack of Card Saver I semi-rigid holders for grading submissions and mailing. Built for regular submitters and sellers who prep cards in bulk.

Semi-rigids are what PSA asks for: a card goes into a clear penny sleeve, then into the semi-rigid, with no top loaders, tape or pull tabs. The open lip lets the grader remove the card without bending the holder, and the semi-rigid body resists bends in the post without clamping hard on corners. Many sellers also use them to ship raw cards because the buyer can slide the card out easily.

Choose the 50-pack if you submit to PSA several times a year, run a group submission with friends, or ship raw singles in semi-rigids. At this quantity you can prep a bulk submission in one sitting rather than splitting it across orders. If you are sending your first few cards, the 25-pack is enough. The CardPop PSA Submission Kit bundles semi-rigids with penny sleeves, team bags, bubble wrap and cardboard protectors if you would rather start with everything in one box.$copy$, updated_at = now()
  where upper(sku) = 'CP-CARD-SAVERS-50-PACK';

update public.shop_products set description = $copy$A 25-pack of rigid cardboard mailers that protect graded slabs and top-loaded cards in the post. For sellers who post higher-value cards now and then.

A stiff cardboard outer resists crushing and bending far better than a padded envelope, which is why sellers often use one for graded slabs and valuable raw cards. Pack a raw card in a penny sleeve and top loader, seal it in a team bag, and lay it flat inside. For a slab, slip it into a graded slab protective sleeve first so the case does not scuff, and add a little padding if it can move. Close the mailer and tape it with our clear packing tape.

The 25-pack suits collectors and casual sellers who post a few premium cards a month and want the right packaging ready when a good sale comes in. If you sell graded cards every week or ship for a shop, the 50-pack keeps you stocked longer. For low-value singles and bulk, a bubble mailer is usually enough, so plenty of sellers keep both and choose based on what is going out the door.$copy$, updated_at = now()
  where upper(sku) = 'CP-CARDBOARD-MAILERS-25-PACK';

update public.shop_products set description = $copy$A 50-pack of rigid cardboard mailers for posting graded slabs and top-loaded cards. Made for high-volume sellers, breakers and stores.

When a parcel is carrying a slab or a card worth real money, a rigid outer takes the pressure that would otherwise bend or crack what is inside. Each mailer takes a slab in a protective sleeve or a card in a penny sleeve and top loader, ideally sealed in a team bag, and closes into a flat, stiff package that is hard to fold in a sorting machine or letterbox.

The 50-pack is for people who ship graded cards as routine: marketplace sellers with a steady flow of slab sales, break hosts sending hits to customers, and shops filling online orders. A bulk supply saves running out mid-week and means every order leaves in the same packaging. If you only send the odd premium card, the 25-pack will last you much longer. Keep packing tape, team bags and graded slab sleeves next to the stack so each order can be packed in one go.$copy$, updated_at = now()
  where upper(sku) = 'CP-CARDBOARD-MAILERS-50-PACK';

update public.shop_products set description = $copy$A digital centring gauge that measures a card's borders to help estimate its likely grade. For collectors who pre-grade cards before submitting.

Centring is one of the first things a grader checks. PSA's published standard for a Gem Mint 10 is centring of roughly 55/45 or better on the front and 75/25 on the back, which means the wider border can only be a little larger than the narrower one. That difference is hard to judge by eye, especially on cards with thin or full-art borders. A gauge gives you numbers rather than a guess, so you can decide which cards are worth the grading fee and which belong in a binder.

Choose the digital gauge over the transparent centring tool if you assess a lot of cards, sell on the strength of your pre-grades, or want readings you can compare between cards. The overlay tool is simpler and suits someone checking a handful of pulls before a first submission. Wear cotton or nitrile gloves while measuring raw cards, and once a card passes, sleeve it and move it into a Card Saver I for its trip to the grader.$copy$, updated_at = now()
  where upper(sku) = 'CP-CENTERING-GAUGE-DIGITAL';

update public.shop_products set description = $copy$A transparent overlay tool for checking a card's centring before you send it for grading. Ideal for newer submitters screening their best pulls.

Lay the clear overlay on the card, line up the guides with the borders, and compare left to right and top to bottom. As a reference point, PSA's standard for a Gem Mint 10 is centring of about 55/45 or better on the front and 75/25 on the back. If a card is clearly off-centre, it is unlikely to reach the top grade no matter how sharp its corners are, which can save you a grading fee. Check both the front and back, since the back allowance is looser.

Pick this overlay tool over the digital centring gauge if you want something quick and simple for sorting a stack of pack-fresh cards into "submit" and "keep" piles. It needs no setup and suits occasional submitters. The digital gauge is the better fit if you grade often or sell pre-graded cards and want measured readings. Use anti-static or microfibre cloths to remove dust before you check, and handle raw cards with gloves to avoid prints.$copy$, updated_at = now()
  where upper(sku) = 'CP-CENTERING-TOOL';

update public.shop_products set description = $copy$A three-pack of anti-static cleaning cloths for lifting dust and fingerprints from cards before grading. For collectors prepping raw cards for submission.

Dust specks and fingerprint smudges are easy to miss until a card is under bright light, and they can show up on a grader's bench as surface marks. A gentle wipe with an anti-static cloth removes loose dust and light prints from the card face without scrubbing. Work on a clean, flat surface, use light pressure in one direction, and move the card straight into a penny sleeve once it is clean. Never use liquids or household cleaners on a card.

The three-pack means you can keep one cloth for raw cards, one for sleeves, top loaders and semi-rigids, and a spare in your submission kit or travel bag. Swap to a fresh cloth when one picks up grit, since a dirty cloth can drag particles across a surface. If you also want to polish slabs, display cases and acrylic stands, our premium microfibre five-pack is the better match for those harder surfaces. Pair the cloths with cotton or nitrile gloves so you are not adding new prints as you clean.$copy$, updated_at = now()
  where upper(sku) = 'CP-CLEANING-CLOTHS-3-PACK';

update public.shop_products set description = $copy$An acrylic display case sized to hold a PSA, BGS or SGC graded slab. For collectors who want a graded card on show without handling the slab.

A graded slab is already sealed, but the plastic case can still pick up scratches, dust and fingerprints if it sits loose on a shelf. This display case gives the slab its own clear housing so it can be lifted, dusted and moved without touching the label or case itself. It is a tidy way to feature a card you have had graded, whether it is a vintage Pokémon holo, a modern rookie or a One Piece alt-art.

Choose this case for a card that has already been graded. If the card is still raw, the UV acrylic display case for 35pt cards or a magnetic one-touch holder is the right fit. For a wall display, the graded floating frame suspends a slab between clear panes, and an acrylic stand will prop the case up on a desk. Keep it out of direct sunlight to protect the card's colours, and wipe the acrylic with a microfibre cloth rather than paper towel, which can leave fine scratches.$copy$, updated_at = now()
  where upper(sku) = 'CP-DISPLAY-CASE-GRADED-SLAB';

update public.shop_products set description = $copy$A UV-resistant acrylic screw-down display case for standard 35pt cards. For collectors who want a permanent, sealed display for a raw card.

35pt is the thickness of most standard trading cards, including Pokémon, Magic, Yu-Gi-Oh and sports base cards. The case closes with screws, which makes it a set-and-forget housing for a card you don't plan to take out often. The UV-resistant acrylic helps protect colours from fading when the case sits in a lit room. Tighten the screws only until the case is closed; over-tightening a screw-down holder is a common way to press or crack a card.

Choose this screw-down case over a magnetic one-touch holder when you want a secure, tamper-resistant display for a card that will stay put. The one-touch is better if you swap cards in and out, since it opens without tools. For thicker relic or patch cards, use a magnetic holder in the matching 55pt, 75pt or 100pt size instead, because a 35pt case is built for standard thickness only. Pop the finished case onto an acrylic stand to show it upright.$copy$, updated_at = now()
  where upper(sku) = 'CP-DISPLAY-CASE-UV-35PT';

update public.shop_products set description = $copy$A 25-pack of write-on tabbed dividers for sorting card storage boxes by set, player or type. For collectors bringing order to bulk boxes.

A storage box full of loose cards is only useful if you can find things in it. Drop a divider in front of each group, write the set name, Pokémon type, team or player on the tab, and you can flick straight to the section you need when building a deck, filling a binder or pulling cards for a sale. Dividers also keep sleeved stacks standing upright so cards don't slump and bend in a half-empty row.

Twenty-five dividers is enough to section several boxes in detail or one large box with plenty of categories. They pair naturally with our 550, 800 and 3200-count cardboard storage boxes. Use them to split a box into sets and subsets, or into "for trade", "to grade" and "keepers" so your workflow stays obvious at a glance. Because the tabs are write-on, a pencil lets you relabel a section as a collection changes.$copy$, updated_at = now()
  where upper(sku) = 'CP-DIVIDERS-25-PACK';

update public.shop_products set description = $copy$A floating display frame sized to hold a graded slab on a wall or shelf. For collectors who want a graded card displayed like artwork.

A floating frame holds the slab between clear panes so it appears to hover in the frame, with the label and card both visible. It suits a centrepiece card, such as a high-grade vintage holo, a signed slab or a modern chase card, that deserves more than a spot in a storage box. Because the slab stays sealed in its grading case, the card itself is untouched while it hangs.

Choose the graded floating frame for a card that has already been slabbed by PSA, BGS or SGC. For a raw card, the single-card floating frame is sized for that instead. If you prefer a shelf display without hanging anything, the graded slab display case with an acrylic stand is an alternative. Hang the frame away from direct sunlight and heat sources, since both can fade or warp what is inside over time, and keep a microfibre cloth handy for fingerprints on the panes.$copy$, updated_at = now()
  where upper(sku) = 'CP-FLOATING-FRAME-GRADED';

update public.shop_products set description = $copy$A frameless floating display frame that suspends a single card between two clear panes. For collectors who want to hang a raw card like a print.

The two panes sandwich the card so it looks as if it is floating, with the wall showing around it. It is a clean way to display a favourite full-art, a signed card or a piece of artwork from a set you love. Put the card in a perfect fit sleeve first if you want an extra layer between the card face and the pane, and make sure both surfaces are free of dust before closing it up.

Choose this single-card frame for raw cards. For a graded slab, use the graded floating frame, which is sized for the thicker case. If you rotate your display often, a magnetic one-touch holder on an acrylic stand is quicker to swap, while the floating frame suits a card you plan to leave up for a while. Hang it out of direct sunlight to slow fading, and use a microfibre cloth on the panes.$copy$, updated_at = now()
  where upper(sku) = 'CP-FLOATING-FRAME-SINGLE';

update public.shop_products set description = $copy$Five pairs of lint-free cotton inspection gloves for handling raw cards without leaving fingerprints. For collectors who sort and inspect cards often.

Skin oils leave prints that show up on foil and holo surfaces under light, and on a card heading for grading they can count against you. Cotton gloves put a soft barrier between your fingers and the card, and because cotton absorbs perspiration, they stay comfortable during a long session of sorting a collection, scanning cards for listings or prepping a submission. Wash them gently and let them dry fully before reuse, and swap to a fresh pair once a pair looks grubby.

Choose cotton over our nitrile gloves when comfort over long sessions matters and you want something reusable. Five pairs lets you rotate between washes and keep a clean pair in your submission kit. The trade-off is grip: cotton is less tacky than nitrile, so for picking thin cards off a flat table or sliding them into tight semi-rigids, the nitrile gloves give a firmer hold. Plenty of collectors keep both and pick per task.$copy$, updated_at = now()
  where upper(sku) = 'CP-GLOVES-COTTON-5-PAIRS';

update public.shop_products set description = $copy$A box of 50 powder-free nitrile gloves for clean card handling. For breakers and sellers who handle lots of cards and want fresh gloves each session.

Nitrile is a thin synthetic glove that keeps skin oils and fingerprints off card surfaces while still letting you feel what you are doing. The extra grip helps when lifting a card off a flat table, pushing it into a penny sleeve or sliding it into a Card Saver I. Being powder-free, they won't leave residue on cards or sleeves. Since they are disposable, there is no washing and no risk of grit building up in the fabric.

Pick nitrile over our cotton inspection gloves for jobs that need dexterity and a guaranteed clean pair every time, such as a live break, a big grading prep session or photographing cards for marketplace listings. Cotton gloves are more comfortable for long, slow sorting and can be reused, so they suit browsing a collection. A box of 50 single gloves covers plenty of sessions. Pair with anti-static cloths for dust and a centring tool for pre-grading.$copy$, updated_at = now()
  where upper(sku) = 'CP-GLOVES-NITRILE-50-PACK';

update public.shop_products set description = $copy$A 25-pack of snug protective sleeves that shield graded slabs from scuffs in storage and in the post. For anyone with a growing slab collection.

A grading case is tough, but its clear face scratches easily when slabs rub against each other in a box or slide around in a parcel. A fitted sleeve adds a soft outer layer that takes those scuffs instead, so the case and label stay clean. Slip each slab into its sleeve before it goes into a storage box, a display case or a rigid cardboard mailer for posting.

Twenty-five sleeves covers a decent slab collection or a few months of graded sales. When shipping, sleeve the slab, then pack it in a rigid cardboard mailer and seal with packing tape, so the buyer receives a case as clean as when it left you. For display, the graded slab display case and the graded floating frame give a slab a permanent home, while these sleeves are for the slabs that live in boxes or move often.$copy$, updated_at = now()
  where upper(sku) = 'CP-GRADED-PROTECTORS-25-PACK';

update public.shop_products set description = $copy$A UV-protective magnetic one-touch holder for thick 100pt cards, relics and patch cards. For sports and premium TCG collectors with chunky hits.

Card thickness is measured in points, where one point is a thousandth of an inch. Many patch and memorabilia cards come in around 100pt, far too thick for a standard holder. Forcing a thick card into a holder that is too thin can press the card or stop the case closing, so matching the size matters. A one-touch has two clear halves that close with a magnet, so you can open and reseal it without tools, and the card sits recessed so its edges are not squeezed.

Choose 100pt for patch cards and thick memorabilia cards. If your card measures thinner, step down: 75pt suits thicker jersey and premium cards, 55pt suits thicker inserts and some parallels, and 35pt suits ordinary Pokémon, Magic and sports base cards. If you are unsure, measure the card's edge with calipers before buying, and check the manufacturer's stated thickness on the back of the pack. Stand the finished holder on an acrylic stand or file it in a graded slab sleeve for storage.$copy$, updated_at = now()
  where upper(sku) = 'CP-MAGNETIC-HOLDER-100PT';

update public.shop_products set description = $copy$A UV-protective magnetic one-touch holder for standard 35pt cards. The usual size for Pokémon, Magic, Yu-Gi-Oh, One Piece and sports base cards.

Most standard trading cards are around 35pt thick, so this is the size that fits the cards most people pull from packs. The holder is two clear halves joined by a magnetic closure, so you can open and close it by hand without screws, and the card sits recessed so its edges are not pinched. UV protection helps slow fading when the holder is on display in a bright room.

Choose 35pt for ordinary single cards: a favourite full-art, a chase card from a new set or a rookie you want to keep crisp. If a card is noticeably thicker, such as a relic, jersey or patch card, it needs the 55pt, 75pt or 100pt holder instead, because a too-thin holder will press on it. Compared with our screw-down UV display case, the one-touch is quicker to open, which suits collectors who rotate their display. Rest it on an acrylic stand or a wall mount to show it off.$copy$, updated_at = now()
  where upper(sku) = 'CP-MAGNETIC-HOLDER-35PT';

update public.shop_products set description = $copy$A UV-protective magnetic one-touch holder for 55pt cards. For thicker inserts, parallels and lighter jersey cards that don't fit a standard holder.

A standard trading card is about 35pt, but plenty of inserts, some parallels and common jersey cards come thicker. Squeezing them into a 35pt holder presses on the card and can stop the magnet closing flush, while a holder much too big lets the card rattle around. The 55pt size sits in between. The two clear halves close with a magnet, so there are no screws to over-tighten, and the UV protection helps the card keep its colour on display.

Choose 55pt when a card is a little thicker than a base card but nowhere near patch-card thickness. A rough guide many collectors use is around 1.5mm for 55pt; if your card is closer to 2mm, go to the 75pt holder, and thick patch cards need 100pt. Ordinary Pokémon, Magic and base sports cards belong in the 35pt holder. Check the thickness printed on the pack where the manufacturer lists it, and measure with calipers if you can.$copy$, updated_at = now()
  where upper(sku) = 'CP-MAGNETIC-HOLDER-55PT';

update public.shop_products set description = $copy$A UV-protective magnetic one-touch holder for 75pt cards. For thicker jersey cards, premium sports cards and other chunky inserts.

At 75pt, this holder is for cards noticeably thicker than a pack-standard base card. Collectors commonly put sturdier jersey cards and premium product cards in this size. A correctly sized holder holds the card firmly without squeezing it, and the magnetic closure means you can take it out to inspect or photograph it without hunting for a screwdriver. The UV protection helps the card's colour last when it lives on a shelf.

Choose 75pt when 55pt is too tight but the card isn't a thick patch card. As a rough guide, cards around 2mm thick often fit 75pt, while thicker patch and memorabilia cards move up to the 100pt holder. Standard Pokémon, Magic and sports base cards are 35pt, and thicker inserts or parallels around 1.5mm usually suit 55pt. When a pack or box lists its card thickness, use that number. Once sealed, stand the holder on an acrylic stand or a wall mount.$copy$, updated_at = now()
  where upper(sku) = 'CP-MAGNETIC-HOLDER-75PT';

update public.shop_products set description = $copy$A five-pack of lint-free premium microfibre cloths for polishing card surfaces, slabs and display cases. For keeping displayed cards and cases spotless.

Microfibre lifts fingerprints and dust from smooth surfaces without the fine scratches that paper towel or a shirt sleeve can leave. Use one on graded slab cases before photographing them for a listing, on magnetic one-touch holders and screw-down cases on a display shelf, and on acrylic stands, wall mounts and floating frames. For raw cards, use light pressure and a clean cloth, then sleeve the card straight away.

Choose this five-pack over the anti-static three-pack if most of what you clean is hard plastic and acrylic: slabs, holders, cases and frames. Five cloths means you can keep separate cloths for raw cards and for display gear, with spares for your bag and submission kit. The anti-static cloths are the specialist pick for knocking dust off raw cards before grading. Wash microfibre without fabric softener and let it dry, since softener can leave a film behind that smears across clear plastic.$copy$, updated_at = now()
  where upper(sku) = 'CP-MICROFIBER-CLOTHS-5-PACK';

update public.shop_products set description = $copy$A two-roll pack of strong clear packing tape for sealing bubble mailers, cardboard mailers and parcels. For anyone posting cards or grading submissions.

Clear tape is the last step of a safe card package. Use it to seal the flap of a bubble mailer or rigid cardboard mailer, close the box on a grading submission, and tape a cardboard sandwich together so a top-loaded card cannot slide around. Avoid putting packing tape directly on a top loader or semi-rigid: the residue can make the holder awkward to open and buyers may count it as damage. Painter's tape or a team bag is the better choice to keep a card from sliding out.

Two rolls keep one at the packing station and one in a submission kit or market-day bag, so you are not scrambling to find tape when a sale comes through. It pairs with our bubble mailers and rigid cardboard mailers, and with team bags, top loaders and graded slab sleeves inside the parcel. Sellers sending a lot of orders tend to go through tape faster than expected, so having a second roll on hand saves a trip mid-week.$copy$, updated_at = now()
  where upper(sku) = 'CP-PACKING-TAPE-2-PACK';

update public.shop_products set description = $copy$A 100-pack of side-loading 9-pocket binder pages for large collections. For set collectors and sellers filling several binders.

Each page holds nine standard cards per side in the classic three-by-three grid. Side-loading pockets open from the side rather than the top, so cards are far less likely to slide out when you lift a binder off the shelf or flip through it, and less dust gets in. The pages suit standard 3-ring binders, and penny sleeved or perfect fit sleeved cards slot in for extra protection.

Choose the 100-pack when you are building a master set, running several themed binders or putting a whole collection in pages at once. At nine cards per side, 100 pages gives room for well over a thousand cards. If you are only filling one binder or topping up an existing one, the 25-pack is the tidier buy. Keep bulk and doubles in a cardboard storage box with tabbed dividers, and save page space for the cards you actually want to see when you open the binder.$copy$, updated_at = now()
  where upper(sku) = 'CP-PAGES-9-POCKET-100-PACK';

update public.shop_products set description = $copy$A 25-pack of side-loading 9-pocket binder pages that fit standard 3-ring binders. For collectors filling one binder or topping up a set in progress.

Nine pockets per side is the standard binder layout across Pokémon, Magic, One Piece, Lorcana and sports. Because the pockets load from the side rather than the top, cards stay put when a binder is carried or turned upside down, and less dust settles inside. Slot cards in bare for bulk sets, or sleeve your better cards in perfect fit sleeves first.

The 25-pack suits a single project: a new expansion, a player collection or a trade folder. It is also the right size for replacing a few worn pages in an existing binder without ending up with a box of spares. If you are setting up multiple binders or a big master set, the 100-pack saves restocking. For a ready-made option with fixed pages and a zip closure, see the 9-pocket zip binder, or the 12-pocket premium binder, which holds 480 cards, for larger sets.$copy$, updated_at = now()
  where upper(sku) = 'CP-PAGES-9-POCKET-25-PACK';

update public.shop_products set description = $copy$A 100-pack of soft, acid-free penny sleeves for everyday storage and double-sleeving. For collectors sleeving new pulls and favourites.

A penny sleeve is the thin, clear first layer most cards should go into before anything else. Standard penny sleeves are sized for standard 2.5 x 3.5 inch trading cards, and a sleeved card then slides into a 3 x 4 inch top loader, a Card Saver I or a magnetic one-touch holder. The sleeve keeps the card's surface and edges off the harder plastic and makes it easier to slide in and out. PSA also asks for each card on a submission to be in a clear penny sleeve.

The 100-pack is the right size for someone sleeving the good cards from recent packs, a binder project or a first grading submission. It is easy to keep a pack in your trading bag. If you open a lot of product or sell regularly, the 500-pack covers months of sleeving, and the 1000 carton is set up for stores and high-volume sellers. Pair with top loaders and team bags for posting.$copy$, updated_at = now()
  where upper(sku) = 'CP-PENNY-SLEEVES-100-PACK';

update public.shop_products set description = $copy$A 1000-count carton of soft, acid-free penny sleeves. For high-volume sellers, breakers and stores sleeving cards every day.

Penny sleeves are the basic first layer of protection for any card, sized for standard trading cards and designed to slide inside top loaders, semi-rigids and one-touch holders. In a business setting they get used for everything: every hit pulled in a break, every single that goes into a showcase, every card that leaves in a marketplace order. Running out halfway through a stream or a weekend of sales is the problem this carton solves.

Choose the 1000 carton if you are processing hundreds of cards a week, such as a break host sleeving each hit on camera, a shop filling singles cases, or a seller who sleeves every card before listing. For a collector opening a booster box now and then, the 500-pack is plenty, and the 100-pack suits casual sleeving. Pair the carton with bulk top loaders, 500-count team bags and rigid cardboard mailers to keep a full packing station stocked.$copy$, updated_at = now()
  where upper(sku) = 'CP-PENNY-SLEEVES-1000-PACK';

update public.shop_products set description = $copy$A 500-pack of soft, acid-free penny sleeves. For keen collectors and regular sellers who sleeve a lot of cards but don't need a full carton.

A penny sleeve is the clear inner layer for standard trading cards that protects the surface from scratches and keeps edges from rubbing against a top loader or semi-rigid. Sleeve cards as they come out of packs, before they go into top loaders for posting, and before they go into Card Savers for grading. Clear sleeves let graders and buyers see the card plainly.

The 500-pack sits between our two other sizes. It suits a collector who opens booster boxes or sports hobby boxes regularly and sleeves every rare, or a marketplace seller who lists a steady stream of singles. It lasts a long time without taking up the shelf space of a 1000 carton, which is aimed at stores and break hosts. If you only sleeve the occasional pull, the 100-pack is easier to keep in a bag. Team bags and top loaders in matching quantities make a complete posting setup.$copy$, updated_at = now()
  where upper(sku) = 'CP-PENNY-SLEEVES-500-PACK';

update public.shop_products set description = $copy$A 100-pack of snug clear inner sleeves sized for standard cards, ideal for double-sleeving. For players and collectors protecting a deck or binder.

A perfect fit sleeve is cut close to the card's size so it fits tight, unlike a looser penny sleeve. In double-sleeving, the card goes into a perfect fit sleeve first, and that sleeved card then goes into the outer deck sleeve upside down, so the two openings sit at opposite ends. That keeps dust and spills out and stops the card shifting inside. Collectors also use perfect fits on their own inside binder pages and floating frames for a close, clean layer.

The 100-pack covers one standard 60-card constructed deck or a Commander deck with room to spare, or a binder project of chase cards. If you sleeve multiple decks, rotate between formats or protect a whole collection, the 200-pack saves you buying twice. Pair these with our premium gloss or premium matte deck sleeves as the outer layer, and store the finished deck upright in a box so the sleeves don't warp.$copy$, updated_at = now()
  where upper(sku) = 'CP-PERFECT-FIT-SLEEVES-100-PACK';

update public.shop_products set description = $copy$A 200-pack of snug clear inner sleeves for double-sleeving. For players with multiple decks and collectors sleeving a large binder.

Perfect fit sleeves sit tight against a standard card, forming the inner layer of a double-sleeved deck. Slide the card in, then put it into an outer deck sleeve from the opposite end so neither opening lines up. The tight fit keeps the card from moving and helps keep dust and moisture out. They also suit binders and display frames when you want a thin protective layer that doesn't hide the card.

Choose the 200-pack if you play more than one format or own two or more decks, such as a Pokémon league deck and a Commander deck, or if you want to inner-sleeve a whole binder of rares. It means you can sleeve everything to the same standard in one sitting. A single deck or a smaller project is better served by the 100-pack. Use our premium gloss or premium matte sleeves as outers, and keep spares with your deck box for when a sleeve splits.$copy$, updated_at = now()
  where upper(sku) = 'CP-PERFECT-FIT-SLEEVES-200-PACK';

update public.shop_products set description = $copy$A 100-pack of glossy premium deck sleeves with a clear front and coloured back. For players who want card art to look sharp through the sleeve.

Deck sleeves protect cards during play and shuffling, and the opaque coloured back hides wear differences between cards so a deck stays tournament friendly. A gloss finish is clear and shiny, which shows card art with strong colour and contrast. The trade-off is that gloss reflects more light under bright venue lighting, and some players find gloss backs more slippery when pile shuffling. Others prefer that slicker feel for riffle shuffling.

Choose gloss over our premium matte sleeves if you care most about how card art looks through the sleeve, play at home or in well-lit casual groups, or prefer a slick shuffle. Matte is the better choice if glare bothers you or you like a textured, grippy shuffle. One hundred sleeves covers a 60-card deck or a 100-card Commander deck. For extra protection, put each card into a perfect fit inner sleeve first, then into the gloss sleeve from the opposite end.$copy$, updated_at = now()
  where upper(sku) = 'CP-PREMIUM-GLOSS-SLEEVES-100-PACK';

update public.shop_products set description = $copy$A 100-pack of matte-finish premium deck sleeves with a durable, anti-glare back. For competitive players who shuffle a lot and play under bright lights.

A matte finish cuts down reflections from overhead lighting, which makes cards easier to read across the table at a store or event. The textured back also helps cards separate cleanly so they don't stick together during a shuffle, which many players prefer for long tournament days. The coloured back keeps a deck uniform so no card stands out from the rest.

Choose matte over our premium gloss sleeves if you play competitively, shuffle often or find glare distracting. Gloss suits players who prefer maximum art clarity and a slick feel. One hundred sleeves fits a standard 60-card deck plus sideboard or a 100-card Commander deck. For double-sleeving, slide each card into a perfect fit inner sleeve first, then into the matte sleeve from the opposite end. Keep spares, since a split sleeve in a tournament deck needs replacing quickly so it does not mark that card out.$copy$, updated_at = now()
  where upper(sku) = 'CP-PREMIUM-MATTE-SLEEVES-100-PACK';

update public.shop_products set description = $copy$A large-capacity storage box that holds around 3200 cards. For collectors and sellers with big bulk collections that need one organised home.

Boxes in this size are usually laid out in rows, so instead of one long stack you get several lanes you can dedicate to different sets, games or rarities. Capacity figures for card boxes are approximate and depend on card thickness, and sleeved cards take more room, so expect fewer if everything is in penny sleeves. Add tabbed dividers within each row and you can find a single common, a playset or a player's run in seconds.

Choose the 3200-count box when your bulk has outgrown a stack of small boxes, or when you want one container for a whole game. It suits sellers storing marketplace inventory and players keeping every common and uncommon for deck building. If you want something to carry to a trade night or file one set at a time, the 550 and 800-count boxes are lighter and easier to shelve. Keep it in a dry spot off the floor, and use the smaller boxes for sleeved cards you access more often.$copy$, updated_at = now()
  where upper(sku) = 'CP-STORAGE-BOX-3200CT';

update public.shop_products set description = $copy$A sturdy cardboard storage box that holds around 550 cards, or fewer once they are sleeved. For collectors who want a compact, single-set box that is easy to carry.

The 550 size is one of the common single-row card box formats, small enough to hold a set, a deck collection or a trade stock without becoming heavy. Sleeved cards stand upright in one long lane, and a few tabbed dividers turn it into a quick-reference file sorted by rarity, number or type. The lid keeps dust off between sessions.

Choose 550 when you want one box per set or per project, or something compact to take to a league night or card show. It is also a tidy home for a single sealed booster box's worth of opened cards. If your sets are bigger or you want fewer boxes on the shelf, the 800-count box holds more in the same single-row style. For bulk that runs into the thousands, the 3200-count box is the better fit. Add dividers from our 25-pack and keep the box away from damp.$copy$, updated_at = now()
  where upper(sku) = 'CP-STORAGE-BOX-550CT';

update public.shop_products set description = $copy$A sturdy cardboard storage box that holds around 800 cards, or fewer once they are sleeved. For collectors who want more room per box without moving to a bulk carton.

The 800-count is a longer single-row box, so it takes a bigger set, a few decks' worth of cards or a seller's working stock of singles while staying light enough to pull off a shelf with one hand. Sleeved cards stand in a single lane, and tabbed dividers split it into sections by set, type or rarity so you can find a card quickly when filling an order.

Choose 800 when a 550 box keeps running out of room, such as for larger expansions, sports sets with lots of inserts, or a growing trade stock. It keeps related cards together in one box rather than splitting them across two. If you are filing smaller sets or want something lighter to carry, the 550-count box suits better, and for very large bulk collections the multi-row 3200-count box saves shelf space. Pair with our dividers and penny sleeves, and store boxes off the floor in a dry room.$copy$, updated_at = now()
  where upper(sku) = 'CP-STORAGE-BOX-800CT';

update public.shop_products set description = $copy$CardPop's PSA submission kit, with the supplies to sleeve, hold and pack cards for grading. For collectors preparing a full submission in one go.

The kit follows the packing method PSA's shipping guide describes. Each card goes into a clear penny sleeve, then into a card saver semi-rigid holder (PSA asks for no top loaders, tape or pull tabs). Stack the cards in the same order as your submission form, sandwich the stack between the cardboard protectors, and wrap it in bubble wrap so it cannot shift in the box. Team bags let you group or protect cards while you prep, and the included packing instructions walk you through it.

Choose this kit over the lighter CardPop Grading Starter Kit if you are sending a proper submission and want the protective packing as well as the sleeves and holders. The starter kit covers sleeving and holders for getting started, but leaves the outer packing to you. Use a centring tool to decide which cards are worth grading, cotton or nitrile gloves while handling them, and finish with clear packing tape on the box.$copy$, updated_at = now()
  where upper(sku) = 'CP-SUBMISSION-KIT-PSA';

update public.shop_products set description = $copy$CardPop's grading starter kit: 100 penny sleeves, 100 team bags and 25 semi-rigids, with a submission checklist. For first-time submitters.

The kit covers the core prep for a grading order. Every card goes into a clear penny sleeve, then into a semi-rigid holder, which is what PSA's shipping guide asks for in place of top loaders. With 25 semi-rigids, you can prepare a typical first submission, and the larger counts of penny sleeves and team bags leave plenty over for everyday storage of the cards that don't make the cut. The checklist helps you work through each step in order so nothing is missed.

Choose the starter kit if you are testing the waters or sending a modest batch. It does not include outer packing, so add a rigid cardboard mailer or a small box, bubble wrap and packing tape for the trip. If you want all of that in one bundle, the CardPop PSA Submission Kit includes bubble wrap, cardboard protectors and packing instructions. A centring tool is a handy extra for choosing which cards to send.$copy$, updated_at = now()
  where upper(sku) = 'CP-SUBMISSION-KIT-STARTER';

update public.shop_products set description = $copy$A 100-pack of resealable team bags that fit a sleeved or top-loaded card. For collectors and sellers adding an outer layer for storage and posting.

A team bag is the clear resealable outer bag that goes over a card that is already protected. Drop in a top-loaded card and the sealed flap stops it sliding out of the top loader, while keeping dust and damp out. That is why sellers bag every top loader before it goes into a mailer. They also hold a small team set of sleeved cards together, which is where the name comes from, and they work for semi-rigids and one-touch holders too.

The 100-pack suits collectors who bag their better cards for storage, and casual sellers posting a few orders a week. Because the seal can be opened and closed again, a buyer can get the card out without cutting anything. If you post daily or run breaks, the 500-pack keeps you stocked far longer. Pair with penny sleeves, top loaders and bubble mailers for a complete posting setup.$copy$, updated_at = now()
  where upper(sku) = 'CP-TEAM-BAGS-100-PACK';

update public.shop_products set description = $copy$A bulk 500-pack of resealable team bags for sleeved and top-loaded cards. For high-volume sellers, breakers and shops.

Team bags are the outer layer in a standard card-posting setup. Once a card is in a penny sleeve and a top loader, the bag seals over it so the card can't slip out and dust and moisture stay out. They also keep a team set or a small lot together, and they fit over semi-rigids and magnetic holders. In a busy packing routine, bagging every order the same way looks professional and protects you if a parcel gets damp.

Choose 500 when you are bagging hits from breaks, packaging dozens of marketplace orders a week, or stocking a store's singles counter. It sits naturally alongside the 1000-count penny sleeve carton and 200-pack of top loaders for a full packing station. If you only bag cards for your own storage or post occasionally, the 100-pack is enough and takes less room. Seal each bag firmly, and don't tape directly onto the top loader inside.$copy$, updated_at = now()
  where upper(sku) = 'CP-TEAM-BAGS-500-PACK';

update public.shop_products set description = $copy$A 100-pack of rigid PVC 3 x 4 inch top loaders for standard trading cards. For active collectors and sellers who need a solid supply.

3 x 4 inches is the standard top loader size, made for standard 2.5 x 3.5 inch cards. The rigid plastic stops bends and creases, which is why a top loader is the go-to holder for storing good cards and for posting them. Put the card in a penny sleeve first so it slides in smoothly and its surface does not rub, then seal the top loader in a team bag before it goes in a mailer.

The 100-pack is the middle option. It suits a collector protecting the hits from several booster boxes, or a marketplace seller posting a few cards a week, without the bulk of a 200-pack. If you only need holders for a handful of chase cards, the 25 or 50-pack will do. Sellers posting daily or break hosts should look at the 200-pack. Keep penny sleeves, team bags and bubble mailers in matching numbers so every card leaves packed the same way.$copy$, updated_at = now()
  where upper(sku) = 'CP-TOP-LOADERS-100-PACK';

update public.shop_products set description = $copy$A bulk 200-pack of rigid PVC 3 x 4 inch top loaders for standard trading cards. For high-volume sellers, break hosts and stores.

Top loaders are the standard rigid holder for a standard-size card: sleeve the card in a penny sleeve, slide it into the 3 x 4 inch top loader, and it is protected from bends in a box, a showcase or the post. For posting, seal the loaded top loader in a team bag and send it in a bubble mailer or rigid cardboard mailer.

The 200-pack is built for volume. It suits break hosts who top-load every hit, sellers who ship many marketplace orders a week, and stores filling singles cases. Buying at this size means you are not running out partway through a busy period. For a personal collection or occasional selling, the 100-pack is easier to store, and the 25 and 50-packs suit protecting a few favourites. Match it with the 1000-count penny sleeve carton and the 500-pack of team bags for a packing station that runs for months.$copy$, updated_at = now()
  where upper(sku) = 'CP-TOP-LOADERS-200-PACK';

update public.shop_products set description = $copy$A 25-pack of rigid PVC 3 x 4 inch top loaders for standard trading cards. For new collectors protecting their first few good pulls.

A top loader is the rigid clear holder that keeps a card flat and stops bends. The 3 x 4 inch size is the industry standard for standard 2.5 x 3.5 inch cards, which covers Pokémon, Magic, One Piece, Lorcana and most sports cards. Slide the card into a penny sleeve first, then into the top loader, so the card goes in easily and its face is not scratched by the harder plastic.

Twenty-five is a good starting number for someone who has just started opening packs and wants to protect the rares and hits worth keeping. It is also handy for topping up a trading bag or sending the odd card to a friend. If you are opening product regularly, the 50-pack gives more breathing room, while the 100 and 200-packs suit sellers and break hosts. Add a team bag over each loaded top loader if you plan to post it or store it long term.$copy$, updated_at = now()
  where upper(sku) = 'CP-TOP-LOADERS-25-PACK';

update public.shop_products set description = $copy$A 50-pack of rigid PVC 3 x 4 inch top loaders for standard trading cards. For regular collectors and casual sellers who keep top loaders on hand.

Top loaders in the 3 x 4 inch size are the standard rigid holder for standard-size trading cards. They keep a card flat in a storage box, a trade binder pocket or a mailer. Sleeve the card in a penny sleeve before loading it, and for posting, slip the loaded top loader into a resealable team bag before it goes into a bubble mailer.

Choose 50 when the 25-pack runs out too quickly, such as for collectors who open a booster box or hobby box every few weeks, or players who top-load their best cards for trading. It is also a sensible size for someone who has started selling a few cards on the CardPop marketplace. If you sell weekly or run breaks, the 100 and 200-packs keep you stocked for longer. For grading submissions, use Card Saver I semi-rigids rather than top loaders, as PSA asks.$copy$, updated_at = now()
  where upper(sku) = 'CP-TOP-LOADERS-50-PACK';

update public.shop_products set description = $copy$A three-pack of wall-mounted acrylic card holders for displaying cards on a wall. For collectors building a small display in a games room or bedroom.

Wall mounts take your cards off the shelf and put them at eye level. A row of three works well for a themed display, such as starter Pokémon, a set's three chase cards or three generations of a favourite player's rookies. The clear acrylic keeps the focus on the card. Put each card in a penny sleeve or perfect fit sleeve first so the acrylic does not rub the surface, and pick a wall out of direct sunlight to slow fading.

Choose the three-pack over the single mount when you want a matching group or plan to add to the display over time. Three identical mounts line up neatly and look intentional on the wall. If you only have one card to show, the single mount comes with fixings for that job. For graded slabs, a floating frame for graded cards is the better wall option, and acrylic stands suit shelf displays. Wipe the acrylic with a microfibre cloth to keep it clear.$copy$, updated_at = now()
  where upper(sku) = 'CP-WALL-MOUNT-3-PACK';

update public.shop_products set description = $copy$A wall-mounted acrylic holder for displaying one card, with fixings included. For collectors who want one special card on the wall.

A single wall mount turns a favourite card into a feature, whether it is a pull from your first pack, a signed card or the piece that finished a set. Everything needed to hang it is in the box. Sleeve the card in a penny or perfect fit sleeve before mounting so the surface stays clean, choose a spot away from windows and heaters, and check the wall type so the fixings hold firmly.

Choose the single mount for one card or as a gift for a collector. If you are planning a group display, the three-pack gives matching mounts that line up in a row. For a graded slab on the wall, use the graded floating frame, and for a raw card hung like a print, the single floating frame is an alternative look. Keep a microfibre cloth handy to remove dust and fingerprints from the acrylic without scratching it.$copy$, updated_at = now()
  where upper(sku) = 'CP-WALL-MOUNT-SINGLE';

