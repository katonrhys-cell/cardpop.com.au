import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';

const WhatIsGradingPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="What is Card Grading? | CardPop Grading Hub" description="Discover what professional card grading is, why it matters for Australian collectors, and how encapsulated cards command higher prices on the secondary market." />

    <section className="bg-card border-b border-border py-20 text-center">
      <div className="container-default">
        <BookOpen className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">What is Card Grading?</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Learn the basics of card grading, why collectors grade their cards, and the
          benefits of encapsulated cards in the marketplace.
        </p>
      </div>
    </section>

    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      <Link to="/grading" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Grading Hub
      </Link>

      {/* Intro */}
      <div className="bg-card border border-border rounded-3xl p-8 space-y-5 text-muted-foreground leading-relaxed">
        <p>
          Card grading is the process of having a professional third-party company assess the
          condition of a trading card and assign it a numeric grade. The card is then sealed
          in a tamper-evident plastic case — called a <strong className="text-foreground">"slab"</strong> — which displays
          the grade permanently.
        </p>
        <p>
          Grades typically range from <strong className="text-foreground">1 (Poor)</strong> to{' '}
          <strong className="text-foreground">10 (Gem Mint)</strong>, with higher grades representing
          cards in progressively better condition. Graders examine four key areas:{' '}
          <strong className="text-foreground">centering</strong>,{' '}
          <strong className="text-foreground">corners</strong>,{' '}
          <strong className="text-foreground">edges</strong>, and{' '}
          <strong className="text-foreground">surface</strong>.
        </p>
        <p>
          Graded cards are highly sought after by collectors because the grade is independently
          verified, making it easier to buy and sell with confidence. A PSA 10 Charizard, for
          example, commands a significant premium over the same card ungraded — the
          encapsulation proves authenticity and condition.
        </p>
        <p>
          For Australian collectors, grading adds a layer of trust to the secondary market and
          can dramatically increase the resale value of your most prized cards.
        </p>
      </div>

      {/* Why grade? */}
      <div>
        <h2 className="text-2xl font-bold mb-5">Why Grade Your Cards?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Verified Condition', body: 'An independent expert assesses and locks in the card\'s condition permanently — no disputes at sale time.' },
            { title: 'Higher Resale Value', body: 'A PSA 10 or BGS 9.5 typically sells for 2–10× the price of the same card raw, especially on key vintage or chase cards.' },
            { title: 'Protection', body: 'Slabs offer hard-case protection against further wear, handling damage, and environmental factors like humidity.' },
            { title: 'Market Liquidity', body: 'Graded cards are easier to price and sell — buyers know exactly what they\'re getting, which speeds up transactions.' },
            { title: 'Authentication', body: 'Grading companies check for fakes, trimmed cards, and alterations. A graded card is a verified card.' },
            { title: 'Long-term Investment', body: 'Many collectors treat high-grade cards as appreciating assets, tracking market data over months and years.' },
          ].map(({ title, body }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Four pillars */}
      <div>
        <h2 className="text-2xl font-bold mb-5">The Four Grading Pillars</h2>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          {[
            { pillar: 'Centering', desc: 'The ratio of the border on opposite sides of the card. A PSA 10 typically requires 55/45 or better on the front and 75/25 on the back.' },
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

      {/* How to submit from Australia */}
      <div>
        <h2 className="text-2xl font-bold mb-5">How to Submit Your Cards (Australia)</h2>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          {[
            { step: '1', title: 'Choose a Grading Company', body: 'For local convenience, use ACE Grading (AUD pricing, no customs). For international resale value, PSA is the most recognised globally.' },
            { step: '2', title: 'Assess Your Cards First', body: 'Self-grade your cards using our Grading Scales page. Only submit cards you believe will achieve a 7 or higher — lower grades rarely justify the cost.' },
            { step: '3', title: 'Package Cards Correctly', body: 'Penny sleeve → toploader → team bag. For international submissions, add a rigid cardboard layer inside a bubble mailer. Label clearly and insure the parcel.' },
            { step: '4', title: 'Fill Out a Submission Form', body: 'Most graders require an online submission form completed before you post cards. Declare declared value accurately — customs and insurance depend on it.' },
            { step: '5', title: 'Wait for Your Slabs', body: 'Track your submission via the grader\'s portal. Turnaround varies: ACE 7–30 days; international economy 60–150 days. Add shipping time both ways.' },
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
