import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { MapPin, ExternalLink, Star, Trophy, ArrowLeft } from 'lucide-react';

// ─── RETAILER DATA ────────────────────────────────────────────────────────────
// Edit the entries below to add, remove, or reorder retailers.
// Fields: name, location, categories, website, description, featured (bool)
const RETAILERS = [
  {
    name: 'ARK Grading',
    location: 'Melbourne, VIC',
    categories: ['TCG', 'Sports Cards'],
    website: 'https://arkgrading.com.au',
    description:
      'Australian grading service based in Melbourne. Science-backed grading methodology, custom labels, simple AUD pricing, and fast local turnarounds — all without international shipping, customs, or headaches.',
    featured: true,
  },
  // ── Add more retailers below this line ────────────────────────────────────
  // {
  //   name: 'Example Grader',
  //   location: 'Sydney, NSW',
  //   categories: ['TCG'],
  //   website: 'https://example.com.au',
  //   description: 'Description of the grader.',
  //   featured: false,
  // },
];

const CATEGORY_COLORS = {
  TCG: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Sports Cards': 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const RetailerCard = ({ retailer, rank }) => (
  <div className={`bg-card border rounded-2xl p-6 flex flex-col gap-4 ${retailer.featured ? 'border-primary/50 shadow-md' : 'border-border'}`}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {rank}
        </span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg leading-tight">{retailer.name}</h3>
            {retailer.featured && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Trophy className="w-3 h-3" /> Featured
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {retailer.location}
          </div>
        </div>
      </div>
      <a
        href={retailer.website}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        Visit <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>

    <p className="text-sm text-muted-foreground leading-relaxed">{retailer.description}</p>

    <div className="flex flex-wrap gap-2">
      {retailer.categories.map((cat) => (
        <span key={cat} className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground'}`}>
          {cat}
        </span>
      ))}
    </div>
  </div>
);

const LocalGradersPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Local Card Graders in Australia | Submit Locally | CardPop"
      description="Find trusted Australian card grading services for TCG and sports cards. Compare local graders offering AUD pricing, fast turnarounds, and no international shipping hassles."
      keywords="local card grading australia, australian card grader, TCG grading australia, sports card grading australia, card grading melbourne, submit cards locally australia, ark grading"
    />

    {/* Hero */}
    <section className="bg-card border-b border-border py-16 text-center">
      <div className="container-default">
        <MapPin className="w-12 h-12 text-primary mx-auto mb-5" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Submit Locally with Trusted Graders</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Australian collectors no longer need to ship cards overseas. Discover local grading
          services that offer AUD pricing, faster turnarounds, and none of the customs headaches
          that come with international submissions.
        </p>
      </div>
    </section>

    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">

      {/* Back link */}
      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

      {/* Why grade locally */}
      <section>
        <h2 className="text-2xl font-bold mb-3">Why Grade Locally in Australia?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          International grading companies like PSA, BGS, and CGC are popular for global resale, but
          submitting from Australia comes with real costs — international postage, insurance, customs
          duties, and GST on the return shipment can add <strong>$30–$80+ AUD</strong> to each parcel
          before you factor in grading fees.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Local Australian graders accept submissions domestically, invoice in AUD, and typically
          return cards in weeks rather than months. For cards destined for the Australian market,
          a local slab can be just as compelling — and significantly cheaper — than an international one.
        </p>
      </section>

      {/* What to look for */}
      <section>
        <h2 className="text-2xl font-bold mb-3">What to Look for in a Local Grader</h2>
        <ul className="space-y-2 text-muted-foreground text-sm leading-relaxed list-disc list-inside">
          <li><strong>Transparent grading criteria</strong> — published standards or sub-grades so you understand how your card was assessed.</li>
          <li><strong>Tamper-evident slabs</strong> — cases that clearly show interference and protect long-term.</li>
          <li><strong>Population reports</strong> — data on how many copies of a card have been graded helps buyers evaluate rarity.</li>
          <li><strong>AUD pricing</strong> — no currency conversion surprises.</li>
          <li><strong>Clear turnaround tiers</strong> — economy through express options with realistic timeframes.</li>
          <li><strong>Australian community reputation</strong> — check Discord groups, Facebook collector communities, and Reddit (r/pokemoncards AU threads) for real feedback.</li>
        </ul>
      </section>

      {/* Retailer list */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <Star className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold">Australian Grading Services</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Ranked by our editorial team based on reputation, transparency, and community feedback.
          Know a grader we should add? <Link to="/contact" className="text-primary hover:underline">Get in touch.</Link>
        </p>

        {RETAILERS.length === 0 ? (
          <p className="text-muted-foreground text-sm">No graders listed yet — check back soon.</p>
        ) : (
          <div className="space-y-4">
            {RETAILERS.map((retailer, i) => (
              <RetailerCard key={retailer.name} retailer={retailer} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground border-t border-border pt-6">
        CardPop is not affiliated with any grading service listed above. Listings are editorial and
        based on publicly available information and community feedback. Always do your own research
        before submitting cards.
      </p>

    </div>
  </div>
);

export default LocalGradersPage;
