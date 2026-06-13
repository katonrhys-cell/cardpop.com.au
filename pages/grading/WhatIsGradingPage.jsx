import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, ArrowLeft, ShieldCheck, TrendingUp, Shield, Zap } from 'lucide-react';

const WHY_GRADE = [
  {
    icon: TrendingUp,
    title: 'Value Protection & Increase',
    body: 'High-grade cards consistently sell for significant premiums over their raw counterparts. Grading establishes an objective baseline for market value.',
  },
  {
    icon: Shield,
    title: 'Preservation',
    body: 'The durable, UV-resistant acrylic slabs permanently protect the card from handling damage, moisture, and environmental wear.',
  },
  {
    icon: ShieldCheck,
    title: 'Authenticity Guarantee',
    body: 'Removes doubt during buyer-to-seller transactions. Encapsulation guarantees the card isn\'t fake or altered.',
  },
  {
    icon: Zap,
    title: 'Liquidity',
    body: 'Graded cards are highly liquid assets. A documented condition rating allows collectors to trade online with absolute confidence.',
  },
];

const WhatIsGradingPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="What is Card Grading? | CardPop Grading Hub"
      description="Discover what professional card grading is, how the authentication and encapsulation process works, and why Australian collectors are grading more cards than ever."
    />

    <section className="bg-card border-b border-border py-20 text-center">
      <div className="container-default">
        <BookOpen className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">What is Card Grading?</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Trading card grading is the process of submitting a raw (ungraded) card to an
          independent, third-party authentication company to verify its authenticity and
          evaluate its physical condition.
        </p>
      </div>
    </section>

    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

      {/* The Grading Process */}
      <div>
        <h2 className="text-2xl font-bold mb-5">The Grading Process</h2>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          {[
            {
              step: '1',
              title: 'Authentication',
              body: 'Experts ensure the card is not counterfeit, altered, or trimmed.',
            },
            {
              step: '2',
              title: 'Evaluation',
              body: 'The card is graded on a scale (usually 1 to 10) based on four key attributes: Centering, Corners, Edges, and Surface.',
            },
            {
              step: '3',
              title: 'Encapsulation',
              body: 'The card is sonically sealed in a tamper-evident plastic case (called a "slab") along with a label displaying the card\'s details, assigned grade, and a unique certification number.',
            },
          ].map(({ step, title, body }, i, arr) => (
            <div key={step} className={`flex gap-5 px-7 py-6 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-sm">{step}</span>
              <div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why Grade? */}
      <div>
        <h2 className="text-2xl font-bold mb-5">Why Grade Your Cards?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {WHY_GRADE.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The Four Grading Pillars */}
      <div>
        <h2 className="text-2xl font-bold mb-5">The Four Grading Pillars</h2>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          {[
            { pillar: 'Centering', desc: 'The ratio of the border on opposite sides of the card. PSA 10 typically requires 55/45 or better on the front and 75/25 on the back.' },
            { pillar: 'Corners', desc: 'Examined under magnification. Any fraying, wear, or rounding reduces the grade. Gem Mint corners appear sharp and fresh.' },
            { pillar: 'Edges', desc: 'The four edges of the card are checked for nicks, chips, or roughness that occur from handling, packs, or storage.' },
            { pillar: 'Surface', desc: 'Scratches, print lines, stains, creases, and indentations on both the front and back are carefully checked under light.' },
          ].map(({ pillar, desc }, i, arr) => (
            <div key={pillar} className={`px-7 py-5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
              <h3 className="font-bold text-primary mb-1">{pillar}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How to Submit from Australia */}
      <div>
        <h2 className="text-2xl font-bold mb-5">How to Submit Your Cards (Australia)</h2>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          {[
            { step: '1', title: 'Choose a Grading Company', body: 'For local convenience, use ARK Grading (arkgrading.com.au) — Melbourne-based, Australian submissions only, AUD pricing, no customs. For international resale value, PSA is the most recognised globally.' },
            { step: '2', title: 'Assess Your Cards First', body: 'Self-grade using our Grading Scales page. Only submit cards you believe will achieve a 7 or higher — lower grades rarely justify the cost.' },
            { step: '3', title: 'Package Cards Correctly', body: 'Penny sleeve → toploader → team bag. For international submissions, add a rigid cardboard layer inside a bubble mailer. Label clearly and insure the parcel.' },
            { step: '4', title: 'Fill Out a Submission Form', body: 'Most graders require an online submission form before you post cards. Declare the value accurately — customs and insurance depend on it.' },
            { step: '5', title: 'Wait for Your Slabs', body: 'Track your submission via the grader\'s portal. ACE: 7–30 days; international economy: 60–150 days. Add shipping time both ways.' },
            { step: '6', title: 'List on CardPop Marketplace', body: 'Once your slabs arrive, list them on CardPop with the grade and cert number. Graded cards sell faster and at higher prices than raw cards.' },
          ].map(({ step, title, body }, i, arr) => (
            <div key={step} className={`flex gap-5 px-7 py-5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-sm">{step}</span>
              <div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/grading/scales" className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all group flex items-center justify-between">
          <div>
            <p className="font-bold group-hover:text-primary transition-colors">View Grading Scales</p>
            <p className="text-sm text-muted-foreground mt-0.5">The full 1–10 condition breakdown</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
        <Link to="/grading/companies" className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all group flex items-center justify-between">
          <div>
            <p className="font-bold group-hover:text-primary transition-colors">Compare Companies</p>
            <p className="text-sm text-muted-foreground mt-0.5">PSA, BGS, CGC, ACE and more</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </div>

    </div>
  </div>
);

export default WhatIsGradingPage;
