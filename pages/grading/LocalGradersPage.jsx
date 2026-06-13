import React, { useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { MapPin, ExternalLink, Star, Trophy, ArrowLeft, ShieldCheck, Award } from 'lucide-react';

// ─── PSA SUBMISSION PARTNERS ─────────────────────────────────────────────────
// Edit to add, remove, or reorder. 'domain' is used to fetch the logo.
const PSA_PARTNERS = [
  {
    name: 'The Hobby',
    domain: 'thehobby.com.au',
    website: 'https://thehobby.com.au',
    description: "Australia's first PSA Certified Dealer in the Southern Hemisphere (since 2016). Grades TCG and sports cards including AFL and Pokémon. Widely trusted as Australia's benchmark PSA partner.",
  },
  {
    name: 'Slabbys',
    domain: 'slabbys.com.au',
    website: 'https://slabbys.com.au',
    description: 'Full-service PSA & Beckett submission with 7-stage tracking, fully insured, and transparent upfront pricing. 12 PSA tiers from Value Bulk ($48) to Walkthrough. Handles all packaging, paperwork, customs, and shipping.',
  },
  {
    name: 'SLABD',
    domain: 'slabd.com.au',
    website: 'https://slabd.com.au',
    description: 'Australian-based fully insured PSA and BGS submission service. Cards are insured from receipt through to return. Clear tiered pricing and reliable turnaround communication.',
  },
  {
    name: 'Cherry Collectables',
    domain: 'cherrycollectables.com.au',
    website: 'https://www.cherrycollectables.com.au/pages/grading',
    description: 'PSA submission partner with Melbourne store drop-off or mail-in options. Accepts TCG and AFL/sports cards. Trusted community retailer with a strong collector following across Australia.',
  },
  {
    name: 'Mana Market',
    domain: 'manamarket.com.au',
    website: 'https://manamarket.com.au/pages/psa-grading-services',
    description: 'Gold Coast-based PSA Registered Dealer. Ideal for Queensland collectors. Straightforward submission process with in-store drop-off available for local customers.',
  },
];

// ─── BECKETT (BGS) SUBMISSION PARTNERS ───────────────────────────────────────
const BGS_PARTNERS = [
  {
    name: 'Cherry Collectables',
    domain: 'cherrycollectables.com.au',
    website: 'https://www.cherrycollectables.com.au/pages/beckett-grading',
    description: "Australia's exclusive Beckett (BGS) submission partner. Melbourne store drop-off or mail-in. BGS provides four individual sub-scores per card alongside the overall grade — ideal for high-value TCG and sports cards.",
  },
  {
    name: 'Graded Cards Australia',
    domain: 'gradedcardsaustralia.com.au',
    website: 'https://gradedcardsaustralia.com.au/collections/beckett-card-grading-australia',
    description: 'Authorised BGS submission partner. Cards are listed in the official BGS Population Report and returned in tamper-secure Beckett encapsulation. Accepts AFL, NBA, and Pokémon.',
  },
  {
    name: 'SLABD',
    domain: 'slabd.com.au',
    website: 'https://slabd.com.au/beckett-grading-services-bgs/',
    description: 'Fully insured Beckett submission from Australia. Handles all international shipping and customs with complete insurance coverage from the moment cards are received.',
  },
  {
    name: 'Slabbys',
    domain: 'slabbys.com.au',
    website: 'https://slabbys.com.au/grading/beckett',
    description: 'BGS submission via Slabbys with 4 tiers — Base ($45, 75+ business days) through Priority ($500, 5 business days). Every submission includes sub-grades. Fully tracked and insured.',
  },
  {
    name: 'The Card Spot',
    domain: 'thecardspot.com.au',
    website: 'https://thecardspot.com.au/products/beckett-grading-bgs',
    description: 'Monthly BGS batch submissions — cards dispatched to Beckett the first week of each month. Suited to collectors who plan ahead and want a reliable, consistent submission process.',
  },
];

// ─── LOCAL AUSTRALIAN GRADERS — TCG ─────────────────────────────────────────
// Ranked for TCG cards (Pokémon, MTG, Yu-Gi-Oh, etc.)
const TCG_GRADERS = [
  {
    name: 'Card Grading Australia (CGA)',
    location: 'Australia-wide',
    domain: 'cardgradingaustralia.com',
    website: 'https://www.cardgradingaustralia.com',
    description: "Australia's original grading service, established 2012. 100-point internal system presented as a 1–10 scale. Graders bring 80+ years combined experience including forensic science backgrounds. Accepts Pokémon, Yu-Gi-Oh, MTG, Dragon Ball, and more.",
    categories: ['TCG', 'Sports Cards'],
  },
  {
    name: 'TCG Grading',
    location: 'Australia-wide',
    domain: 'tcggrading.com.au',
    website: 'https://tcggrading.com.au',
    description: 'Est. 2021 and already 100,000+ cards graded. Hand-illustrated custom labels by in-house artist Kai Christian. Sub-grades and grader notes visible via serial lookup. Accepts Pokémon, MTG, Dragon Ball, and sports cards. ~40 business day standard turnaround.',
    categories: ['TCG', 'Sports Cards'],
  },
  {
    name: 'ARK Grading',
    location: 'Melbourne, VIC',
    domain: 'arkgrading.com.au',
    website: 'https://arkgrading.com.au',
    description: 'Science-backed grading with digital microscopes, x-ray fluorescence authentication, and algorithm-driven sub-grades. 20 business day max turnaround (premium). Australian submissions only. Serial numbers guaranteed to remain active permanently.',
    categories: ['TCG'],
  },
  {
    name: 'Alpha Card Grading (ACG)',
    location: 'Australia-wide',
    domain: 'alphacardgrading.com.au',
    website: 'https://alphacardgrading.com.au',
    description: 'AI-assisted centering analysis and dual-reviewer process (every card independently reviewed by a second grader before encapsulation). Clean slab design with branding on the reverse. Accepts Pokémon, One Piece, Dragon Ball, and MTG.',
    categories: ['TCG'],
  },
  {
    name: 'Premier Card Grading (PCG)',
    location: 'Australia-wide',
    domain: 'premiercardgrading.com.au',
    website: 'https://premiercardgrading.com.au',
    description: 'Competitive pricing: $25 authentication / $35 standard (2–4 weeks) / $60 express (5 business days). Metal labels. Accepts MTG, Pokémon, Flesh and Blood, Digimon, Dragon Ball, and licensed sports cards.',
    categories: ['TCG', 'Sports Cards'],
  },
];

// ─── LOCAL AUSTRALIAN GRADERS — SPORTS CARDS ─────────────────────────────────
// Ranked for Sports cards (AFL, NRL, NBA, cricket, etc.)
const SPORTS_GRADERS = [
  {
    name: 'Card Grading Australia (CGA)',
    location: 'Australia-wide',
    domain: 'cardgradingaustralia.com',
    website: 'https://www.cardgradingaustralia.com',
    description: "Australia's longest-running grader (est. 2012) and the go-to for sports card collectors. Explicitly accepts AFL, NRL, NBA, and vintage sports cards. Recognised across the Australian collector market — CGA slabs carry strong local resale weight.",
    categories: ['AFL', 'NRL', 'NBA', 'TCG'],
  },
  {
    name: 'TCG Grading',
    location: 'Australia-wide',
    domain: 'tcggrading.com.au',
    website: 'https://tcggrading.com.au',
    description: 'The broadest sports card acceptance of any local grader — explicitly grades NRL, AFL, NBA, FIFA, and F1 cards alongside TCG. Custom illustrated labels and sub-grade lookup make results easy to share and market.',
    categories: ['AFL', 'NRL', 'NBA', 'FIFA', 'F1'],
  },
  {
    name: 'Premier Card Grading (PCG)',
    location: 'Australia-wide',
    domain: 'premiercardgrading.com.au',
    website: 'https://premiercardgrading.com.au',
    description: 'Accepts modern sports cards from licensed publishers. Express option ($60, 5 business days) is one of the fastest local turnarounds available for sports submissions. Metal label presentation.',
    categories: ['Sports Cards'],
  },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const LogoImg = ({ domain, name }) => {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <span className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={name}
      className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-border"
      onError={() => setErr(true)}
    />
  );
};

const PartnerLogoCard = ({ partner }) => (
  <a
    href={partner.website}
    target="_blank"
    rel="noopener noreferrer"
    className="flex flex-col items-center gap-3 bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-all group text-center"
    title={partner.name}
  >
    <LogoImg domain={partner.domain} name={partner.name} />
    <span className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">{partner.name}</span>
    <p className="text-xs text-muted-foreground leading-relaxed">{partner.description}</p>
    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-auto">
      Visit <ExternalLink className="w-3 h-3" />
    </span>
  </a>
);

const CATEGORY_COLORS = {
  TCG: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Sports Cards': 'bg-green-500/10 text-green-600 dark:text-green-400',
  AFL: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  NRL: 'bg-green-500/10 text-green-600 dark:text-green-400',
  NBA: 'bg-red-500/10 text-red-600 dark:text-red-400',
  FIFA: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  F1: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const GraderRankCard = ({ grader, rank }) => (
  <a
    href={grader.website}
    target="_blank"
    rel="noopener noreferrer"
    className="flex gap-4 bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-all group"
  >
    <div className="flex flex-col items-center gap-2 shrink-0">
      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
        {rank}
      </span>
      <LogoImg domain={grader.domain} name={grader.name} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h3 className="font-bold leading-tight group-hover:text-primary transition-colors">{grader.name}</h3>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" /> {grader.location}
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{grader.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {grader.categories.map((cat) => (
          <span key={cat} className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground'}`}>
            {cat}
          </span>
        ))}
      </div>
    </div>
  </a>
);

// ─── PAGE ─────────────────────────────────────────────────────────────────────

const LocalGradersPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Card Grading Australia: Local Graders, PSA & Beckett Partners | CardPop"
      description="Australia's ranked guide to card grading services. Compare local Australian graders for TCG and sports cards, plus the best PSA and Beckett submission partners. AUD pricing, fast turnarounds, no customs stress."
      keywords="local card grading australia, PSA grading australia, Beckett grading australia, australian card grader, TCG grading australia, sports card grading australia, AFL card grading, NRL card grading, pokemon grading australia, card grading melbourne"
    />

    {/* Hero */}
    <section className="bg-card border-b border-border py-16 text-center">
      <div className="container-default">
        <MapPin className="w-12 h-12 text-primary mx-auto mb-5" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Submit Locally with Trusted Graders</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Whether you want a locally encapsulated slab or need help submitting to PSA or Beckett,
          here's every trusted Australian grading option — ranked by the CardPop community.
        </p>
      </div>
    </section>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

      {/* ── BECKETT PARTNERS ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <Award className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Beckett (BGS) Submission Partners</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Beckett Grading Services provides four individual sub-scores (centering, corners, edges, surface) alongside an overall grade.
          BGS slabs are especially popular for high-value sports cards and premium TCG chases. These Australian partners handle
          all packaging, international shipping, and customs on your behalf.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BGS_PARTNERS.map((p) => <PartnerLogoCard key={p.name + 'bgs'} partner={p} />)}
        </div>
      </section>

      {/* ── PSA PARTNERS ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">PSA Submission Partners</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          PSA is the world's most recognised card grading company and typically commands the highest resale premiums,
          especially for US-market sales. These Australian authorised dealers handle the entire submission process —
          shipping, insurance, customs, and tracking — so you deal in AUD only.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PSA_PARTNERS.map((p) => <PartnerLogoCard key={p.name + 'psa'} partner={p} />)}
        </div>
      </section>

      {/* ── LOCAL GRADERS — TCG ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <Star className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Australian Local Graders — TCG</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          These companies grade and encapsulate cards entirely within Australia — AUD pricing, no customs, and
          faster returns than international services. Ranked for TCG cards (Pokémon, MTG, Yu-Gi-Oh, Dragon Ball, One Piece, etc.).
        </p>
        <div className="space-y-3">
          {TCG_GRADERS.map((g, i) => <GraderRankCard key={g.name + 'tcg'} grader={g} rank={i + 1} />)}
        </div>
      </section>

      {/* ── LOCAL GRADERS — SPORTS ── */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <Star className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Australian Local Graders — Sports Cards</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Ranked for sports cards — AFL, NRL, NBA, cricket, FIFA, and F1. Local grading is particularly
          cost-effective for Australian-market sports cards where domestic buyer recognition matters more than
          international PSA premiums.
        </p>
        <div className="space-y-3">
          {SPORTS_GRADERS.map((g, i) => <GraderRankCard key={g.name + 'sports'} grader={g} rank={i + 1} />)}
        </div>
      </section>

      {/* ── WHY GRADE LOCALLY ── */}
      <section className="bg-card border border-border rounded-3xl p-8">
        <h2 className="text-xl font-bold mb-3">Why Grade Locally in Australia?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4 text-sm">
          Submitting to PSA or BGS directly from Australia adds real cost — international postage, insurance,
          customs duties, and GST on return can add <strong>$30–$80+ AUD</strong> to each parcel before grading
          fees. Local graders invoice in AUD, return cards in weeks not months, and their slabs carry growing
          recognition in the Australian secondary market.
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
          <li><strong>Transparent criteria</strong> — published grading standards and sub-grades</li>
          <li><strong>Tamper-evident slabs</strong> — protection that buyers and sellers trust</li>
          <li><strong>Population reports</strong> — grade data helps price and market your card</li>
          <li><strong>AUD pricing</strong> — no currency conversion surprises</li>
          <li><strong>Community reputation</strong> — check Discord, r/pokemoncards, and OzCardTrader for real feedback</li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground border-t border-border pt-6">
        CardPop is not affiliated with any grading service or submission partner listed above. Rankings are editorial,
        based on publicly available information and community feedback. Always verify current pricing and turnaround
        times directly with the provider before submitting.
      </p>

    </div>
  </div>
);

export default LocalGradersPage;
