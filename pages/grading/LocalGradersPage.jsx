import React, { useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { MapPin, Star, ArrowLeft } from 'lucide-react';

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
      <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
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
      title="Local Card Graders Australia — TCG & Sports Cards Ranked | CardPop"
      description="Ranked Australian card grading services for TCG and sports cards. AUD pricing, no customs, faster turnarounds than PSA or Beckett. Compare CGA, TCG Grading, ARK Grading, ACG, and PCG."
      keywords="local card grading australia, australian card grader, TCG grading australia, sports card grading australia, AFL card grading, NRL card grading, pokemon grading australia, card grading melbourne, CGA grading, ARK grading"
    />

    {/* Hero */}
    <section className="bg-card border-b border-border py-16 text-center">
      <div className="container-default">
        <MapPin className="w-12 h-12 text-primary mx-auto mb-5" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Submit Locally with Trusted Graders</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Ranked Australian grading services for TCG and sports cards — AUD pricing,
          no customs, and faster returns than international submissions.
        </p>
      </div>
    </section>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

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
