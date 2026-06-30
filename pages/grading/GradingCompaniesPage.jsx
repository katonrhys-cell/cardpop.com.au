import React, { useEffect, useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { Building2, ArrowLeft, ArrowRight, Award, ShieldCheck, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ─── PSA SUBMISSION PARTNERS ─────────────────────────────────────────────────
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

const LogoImg = ({ domain, name }) => {
  const [err, setErr] = React.useState(false);
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

const GradingCompaniesPage = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.from('grading_companies').select('*').order('name').limit(20)
      .then(({ data }) => { if (!cancelled) setGuides(data ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Grading Companies Australia — PSA, BGS, CGC, ACE | CardPop Grading Hub" description="Compare the best trading card grading companies for Australian collectors. PSA, BGS, CGC, and ACE Grading — turnaround times, AUD pricing, and which service is right for you." />

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Companies</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Compare the top third-party grading services like PSA, BGS, CGC, and ACE.
            Learn their histories, scales, and specialised features.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
        </Link>

        {/* Beckett (BGS) Submission Partners */}
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

        {/* PSA Submission Partners */}
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

        {/* Company cards */}
        <div className="space-y-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : guides.length > 0 ? (
            guides.map(guide => (
              <Link
                key={guide.id}
                to={`/grading/guide/${guide.slug || guide.id}`}
                className="block bg-card border border-border rounded-2xl p-7 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold mb-0.5 group-hover:text-primary transition-colors">
                      {guide.name}
                    </h3>
                    <p className="text-primary text-sm font-medium mb-3">{guide.abbreviation}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {guide.description || 'Click to view full grading standards.'}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Country: {guide.country || 'International'}
                </p>
              </Link>
            ))
          ) : (
            <div className="text-center py-16 bg-muted/20 rounded-3xl border border-border border-dashed">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="font-semibold">No grading companies listed yet</p>
              <p className="text-sm text-muted-foreground mt-1">Check back soon.</p>
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div>
          <h2 className="text-2xl font-bold mb-5">Quick Comparison</h2>
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 px-5 py-3 border-b border-border">
              <span>Company</span>
              <span>Best For</span>
              <span>Turnaround</span>
              <span>AU Pricing</span>
            </div>
            {[
              { co: 'PSA',  for: 'Pokémon, Sports', time: '20–150 days', price: 'From $25 USD' },
              { co: 'BGS',  for: 'All TCG, Vintage', time: '15–90 days', price: 'From $22 USD' },
              { co: 'CGC',  for: 'All TCG',          time: '10–60 days', price: 'From $15 USD' },
              { co: 'ARK',  for: 'AU collectors',    time: 'Local turnaround',  price: 'AUD pricing' },
            ].map(({ co, for: f, time, price }, i, arr) => (
              <div key={co} className={`grid grid-cols-4 px-5 py-4 text-sm ${i < arr.length - 1 ? 'border-b border-border/60' : ''} hover:bg-muted/20 transition-colors`}>
                <span className="font-bold text-primary">{co}</span>
                <span className="text-muted-foreground">{f}</span>
                <span className="text-muted-foreground">{time}</span>
                <span className="text-muted-foreground">{price}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GradingCompaniesPage;
