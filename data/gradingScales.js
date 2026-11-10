// Per-company grading scales for /grading/scales/<company> — PSA, BGS, CGC
// and ACE. Dependency-free so the SPA page (pages/grading/GradingScalePage.jsx),
// the bot prerender (api/prerender.js) and the sitemap (api/sitemap.js) read
// one list: add a company here and its page, crawler copy and sitemap entry
// all follow.

export const GRADING_SCALES = {
  psa: {
    name: 'PSA',
    full: 'Professional Sports Authenticator',
    intro: 'Professional Sports Authenticator (PSA) uses a definitive 1–10 scale. Widely considered the industry standard for market liquidity, achieving a PSA 10 Gem Mint grade requires strict adherence to centering and surface preservation.',
    auNote: 'PSA commands the highest price premiums on the global secondary market, making it the best choice for cards destined for international sale. Australian collectors submitting to PSA should use a reputable forwarding service and budget for return shipping, customs, and GST.',
    scales: [
      { grade: '10', label: 'Gem Mint (GEM-MT)',         condition: 'A perfectly centered card with four sharp corners, sharp focus, and full original gloss. Tolerance for centering is roughly 55/45 to 60/40 on the front.' },
      { grade: '9',  label: 'Mint (MINT)',                condition: 'A superb card that exhibits only one minor flaw. Examples include a very slight printing imperfection or slightly off-white borders.' },
      { grade: '8',  label: 'Near Mint-Mint (NM-MT)',     condition: 'Appears Mint at first glance but upon close inspection, exhibits slight fraying on one or two corners, a minor printing imperfection, or slightly off centering.' },
      { grade: '7',  label: 'Near Mint (NM)',             condition: 'Shows slight surface wear, slight fraying on some corners, a minor picture imperfection, or out of register printing.' },
      { grade: '6',  label: 'Excellent-Mint (EX-MT)',     condition: 'Visible surface wear or a minor printing defect. Corners may have slight fuzzing. Picture focus might be slightly out of register.' },
      { grade: '5',  label: 'Excellent (EX)',             condition: 'Minor rounding or fuzzing of corners. Surface wear is noticeable, including minor scratching or minor edge wear.' },
      { grade: '4',  label: 'Very Good-Excellent (VG-EX)', condition: 'Corners may be slightly rounded. Surface wear is noticeable with potential light scuffing or minor creases.' },
      { grade: '3',  label: 'Very Good (VG)',             condition: 'Shows some rounding of corners and slight surface wear. May possess light creases. Edges can be noticeably worn.' },
      { grade: '2',  label: 'Good (G)',                   condition: 'Corners show accelerated rounding. Surface wear is apparent. The card may have scratching, scuffing, or several creases.' },
      { grade: '1',  label: 'Poor (P)',                   condition: 'Heavily damaged. Significant defects including major creases, tears, or tape on both surfaces.' },
    ],
  },
  bgs: {
    name: 'BGS',
    full: 'Beckett Grading Services',
    intro: 'Beckett Grading Services (BGS) is famous for its detailed subgrade system and the highly coveted Pristine 10 Black Label. They utilise half-points to provide a hyper-accurate condition assessment.',
    auNote: 'BGS is a favourite among serious vintage and TCG collectors. The Black Label (four perfect 10 subgrades) is among the most prestigious grades in the hobby. BGS subgrades also provide transparency — buyers know exactly where a card falls short.',
    scales: [
      { grade: '10',  label: 'Pristine / Black Label', condition: 'Flawless card under magnification. 50/50 centering. BGS uniquely awards a \'Black Label\' if all four subgrades (Centering, Corners, Edges, Surface) are perfect 10s.' },
      { grade: '9.5', label: 'Gem Mint',               condition: 'Virtually flawless card. Must have at least 9.5 across most subgrades. Centering must be 50/50 to 55/45.' },
      { grade: '9',   label: 'Mint',                   condition: 'A superb card. May have one minor flaw like a tiny spec or very slight corner wear under magnification.' },
      { grade: '8.5', label: 'Near Mint-Mint+',        condition: 'Very slight edge wear or tiny surface scratching. Still holds excellent visual appeal.' },
      { grade: '8',   label: 'Near Mint-Mint',         condition: 'Slight fraying on corners, minor printing imperfections, or centering down to 65/35.' },
      { grade: '7',   label: 'Near Mint',              condition: 'Visible minor wear on surface or corners. Slight out of register printing allowed.' },
      { grade: '6',   label: 'Excellent-Mint',         condition: 'Visible surface wear, minor scratching, or noticeable corner fuzzing.' },
      { grade: '5',   label: 'Excellent',              condition: 'Corners show minor rounding. Surface exhibits noticeable wear or scuffing.' },
      { grade: '1–4', label: 'Poor to Very Good',      condition: 'Heavily worn cards with varying degrees of creasing, rounding, and surface damage.' },
    ],
  },
  cgc: {
    name: 'CGC',
    full: 'Certified Guaranty Company',
    intro: 'Certified Guaranty Company (CGC) is a dominant force in TCG grading (Pokémon, Magic). Known for strict grading standards and incredibly clear, high-quality slabs.',
    auNote: 'CGC is particularly popular with Pokémon and Magic: The Gathering collectors. Their crystal-clear cases and strict standards have made CGC slabs highly sought after at Australian card shows and on online marketplaces.',
    scales: [
      { grade: '10',  label: 'Pristine / Gem Mint', condition: 'CGC recently unified its top grade. A 10 is a virtually flawless card with 50/50 centering and no visible manufacturing or handling defects.' },
      { grade: '9.5', label: 'Mint+',               condition: 'A card with exceptional eye appeal but falling just short of Gem Mint due to a microscopic flaw or slight off-centering.' },
      { grade: '9',   label: 'Mint',                condition: 'A beautiful card with only a minor flaw, such as a tiny nick on one corner or slight surface wear visible only under magnification.' },
      { grade: '8.5', label: 'Near Mint/Mint+',     condition: 'Very strong eye appeal. May exhibit very slight edge wear or minor print spots.' },
      { grade: '8',   label: 'Near Mint/Mint',      condition: 'Exhibits slight fraying on corners or minor centering issues, but overall presents as a high-end collector copy.' },
      { grade: '7',   label: 'Near Mint',           condition: 'Moderate surface wear, slight fraying on corners, or slight picture imperfection.' },
      { grade: '6',   label: 'Excellent/Near Mint', condition: 'Noticeable surface wear, edge wear, or corner fuzzing. Still retains good overall appeal.' },
      { grade: '5',   label: 'Excellent',           condition: 'Corners show minor rounding. Surface has visible wear, scratching, or minor scuffing.' },
      { grade: '1–4', label: 'Poor to Very Good',   condition: 'Cards exhibiting major defects such as heavy creasing, severe rounding, stains, or tears.' },
    ],
  },
  ace: {
    name: 'ACE',
    full: 'ACE Grading',
    intro: 'ACE Grading has rapidly gained popularity in the Pokémon and TCG community, famous for their stunning, custom colour-matched labels that extend the card\'s artwork. Their 10-point scale aligns closely with industry standards.',
    auNote: 'ACE Grading is Australia\'s home-grown grading service — no international shipping, AUD pricing, and faster turnarounds. ACE 10s are increasingly accepted on the Australian secondary market and are the go-to choice for collectors who want professional grading without the cost and wait of overseas services.',
    scales: [
      { grade: '10',  label: 'Gem Mint',        condition: 'A flawless card presenting perfect centering, razor-sharp corners, and an immaculate surface. Often paired with ACE\'s custom colour-matched labels.' },
      { grade: '9',   label: 'Mint',            condition: 'Exceptional condition with only one minor flaw visible under close inspection.' },
      { grade: '8',   label: 'Near Mint-Mint',  condition: 'Appears Mint but exhibits minor flaws such as slight corner fraying or minor centering deviation.' },
      { grade: '7',   label: 'Near Mint',       condition: 'Shows slight surface wear, slight corner fuzzing, or minor printing defects.' },
      { grade: '6',   label: 'Excellent-Mint',  condition: 'Visible surface wear, minor scratching, or noticeable corner fuzzing.' },
      { grade: '5',   label: 'Excellent',       condition: 'Minor rounding of corners and noticeable surface wear or scuffing.' },
      { grade: '1–4', label: 'Poor to Very Good', condition: 'Cards showing significant signs of play, creasing, severe edge wear, and damage.' },
    ],
  },
};

/** The scale slugs, in display order (psa, bgs, cgc, ace). */
export const GRADING_SCALE_SLUGS = Object.keys(GRADING_SCALES);
