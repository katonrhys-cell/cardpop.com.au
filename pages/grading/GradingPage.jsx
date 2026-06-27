import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import {
  SearchCheck, BookOpen, BarChart2, Building2, ArrowRight,
  Store, ShieldCheck, DollarSign, Clock, MapPin, HelpCircle, TrendingUp, Calculator,
  Sparkles, Flag, Feather, Compass, Rocket, BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// The grading journey, told as a book: a cover, a clear place to begin,
// then six chapters along a single connected path so collectors always
// know where they are and what comes next.
const CHAPTERS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
    chapter: 'Chapter One',
    label: 'Start your journey',
    title: 'What is Card Grading?',
    opening: 'Every collection has a beginning.',
    description:
      'New to grading? Begin here. Learn what professional card grading is, how the process works, and why Australian collectors are grading more than ever.',
    cta: 'Read the guide',
  },
  {
    href: '/grading/scales',
    icon: BarChart2,
    chapter: 'Chapter Two',
    label: 'Learn the language',
    title: 'Grading Scales Explained',
    opening: 'Before you submit, learn to read a grade.',
    description:
      'Understand the 1–10 condition scales used by every major grading company. Know exactly what separates a Gem Mint 10 from a Mint 9 before you submit.',
    cta: 'View the scales',
  },
  {
    href: '/grading/roi-calculator',
    icon: TrendingUp,
    chapter: 'Chapter Three',
    label: 'Decide if it’s worth it',
    title: 'Grading ROI Calculator',
    opening: 'Now, the big question — is it worth it?',
    description:
      'Enter your card, raw cost, and grading service for a probability-weighted expected return powered by live eBay AU prices and full cost breakdowns.',
    cta: 'Calculate ROI',
  },
  {
    href: '/grading/estimator',
    icon: Calculator,
    chapter: 'Chapter Four',
    label: 'Preview your grade',
    title: 'Grade Estimator',
    opening: 'A glimpse of the grade to come.',
    description:
      'Upload photos of your card and receive AI-generated preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC — a helpful guide before you commit to a professional submission.',
    cta: 'Try the estimator',
  },
  {
    href: '/grading/companies',
    icon: Building2,
    chapter: 'Chapter Five',
    label: 'Choose your grader',
    title: 'Grading Companies',
    opening: 'Choose the hands you trust your cards to.',
    description:
      'Compare PSA, BGS, CGC, ACE Grading and more. Find turnaround times, Australian pricing, and which service suits your cards and your budget.',
    cta: 'Compare services',
  },
  {
    href: '/grading/submission-partners',
    icon: MapPin,
    chapter: 'Chapter Six',
    label: 'Submit your cards',
    title: 'Submit Locally with Trusted Graders',
    opening: 'The final step — send them off.',
    description:
      'Reach the destination. Skip international shipping and customs with ranked local Australian grading services, plus the best PSA and Beckett submission partners in Australia.',
    cta: 'View local options',
  },
];

// "Where should I start?" — three quick on-ramps so readers can open the
// book at the page that fits them, instead of feeling they must read it all.
const START_PATHS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
    badge: 'Begin at Chapter One',
    title: 'I’m brand new to grading',
    body: 'Start at the very beginning and learn how grading works, step by step.',
  },
  {
    href: '/grading/roi-calculator',
    icon: Compass,
    badge: 'Skip to Chapter Three',
    title: 'I want to know if it’s worth it',
    body: 'Already know the basics? Jump straight to working out the return on a card.',
  },
  {
    href: '/grading/submission-partners',
    icon: Rocket,
    badge: 'Jump to Chapter Six',
    title: 'I’m ready to submit',
    body: 'You’ve done your homework — find a trusted Australian grader and send it off.',
  },
];

const AU_TIPS = [
  {
    icon: DollarSign,
    title: 'Factor in the Full Cost',
    body: 'International grading (PSA, BGS, CGC) involves shipping, insurance, customs duties, and GST on return. Budget roughly $30–$60 AUD extra per submission parcel on top of grading fees.',
  },
  {
    icon: Clock,
    title: 'Economy Tiers Save Money',
    body: 'Most grading companies offer bulk or economy tiers. If your card isn\'t extremely valuable, an economy submission can still massively improve resale prices for a fraction of express costs.',
  },
  {
    icon: ShieldCheck,
    title: 'Protect Cards Before Submitting',
    body: 'Use penny sleeves and toploaders for every card. Double-sleeve in a team bag for international posts. One scratch in transit can drop a PSA 10 to a PSA 9.',
  },
  {
    icon: TrendingUp,
    title: 'Check the Pop Report First',
    body: 'Before submitting any card, look up its population report on PSA or BGS. A high-population PSA 10 adds little premium over raw; a low-pop 10 on a sought-after card can multiply its value. Knowing the pop protects you from spending $50 grading a card worth the same raw.',
  },
];

const FAQS = [
  {
    q: 'Is card grading worth it in Australia?',
    a: 'For high-value cards — key vintage Pokémon, sports rookies, low-population chase cards — grading can increase resale value 2–10×. For common cards under $50, grading costs often exceed the value gain. The sweet spot is cards worth $80+ AUD raw.',
  },
  {
    q: 'Which grading company is best for Australian collectors?',
    a: 'For local convenience, ARK Grading (arkgrading.com.au) is a Melbourne-based Australian service — AUD pricing, no customs, and fast turnarounds. For cards destined for global resale (eBay US, international buyers), PSA has the highest market recognition and typically commands the largest price premiums.',
  },
  {
    q: 'How long does grading take from Australia?',
    a: 'ARK Grading accepts Australian submissions only and offers fast local turnarounds. For international services (PSA, BGS, CGC), allow 2–6 months door-to-door at economy tiers when factoring in shipping both ways, customs, and grading queue times.',
  },
  {
    q: 'What cards should I grade?',
    a: 'Focus on cards that are rare, in near-perfect condition, and have strong secondary market demand. Key Pokémon (Base Set Charizard, Alt Art holos), sports rookies (LeBron, Giannis, NRL stars), and low-population vintage cards are the best candidates.',
  },
  {
    q: 'Can I grade cards at home?',
    a: 'You can self-assess using our grading scale guide to estimate what grade a card might receive, but only submissions to professional third-party graders produce encapsulated, authenticated slabs that the market values.',
  },
];

const GradingPage = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Grading Hub | CardPop — Australia's Card Grading Resource"
      description="Australia's go-to trading card grading resource. Compare PSA, BGS, CGC and ACE Grading, understand condition scales, and learn how to maximise the value of your collection."
      keywords="card grading australia, PSA grading, ACE grading australia, pokemon grading, BGS grading, CGC cards, trading card grading guide, slab cards australia"
    />

    {/* Hero — the book cover */}
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/[0.07] via-card to-background py-20 sm:py-24 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,theme(colors.primary/12%),transparent_60%)] pointer-events-none" />
      <div className="container-default relative">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-border/70 bg-card/70 px-6 py-12 sm:px-12 shadow-sm backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-7">
            <Feather className="w-3.5 h-3.5" /> A CardPop Field Guide
          </div>

          <SearchCheck className="w-12 h-12 text-primary mx-auto mb-6" />

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            The Grading Journey
          </h1>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground mb-6">
            From raw card to graded slab
          </p>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A story in six short chapters. We’ll take you from the very first
            question — <em>“what even is grading?”</em> — all the way to posting
            your cards off with confidence.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#journey"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <BookOpen className="w-4 h-4" /> Open the book
            </a>
            <a
              href="#start-here"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3 text-sm font-bold text-foreground hover:border-primary/50 transition-colors"
            >
              Where should I start? <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">

      {/* Where to start — pick your opening page */}
      <section id="start-here" className="scroll-mt-8">
        <div className="text-center mb-9">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
            <Compass className="w-4 h-4" /> Find your starting point
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Where should you start?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            You don’t have to read every page. Pick the line below that sounds
            most like you, and we’ll open the book to the right chapter.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {START_PATHS.map(({ href, icon: Icon, badge, title, body }) => (
            <Link
              key={href}
              to={href}
              className="group flex flex-col rounded-3xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">{badge}</span>
              <h3 className="font-bold text-lg mb-1.5 group-hover:text-primary transition-colors">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{body}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-primary font-bold text-sm">
                Take me there <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* The journey — a connected, numbered path of chapters */}
      <section id="journey" className="scroll-mt-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
            <BookMarked className="w-4 h-4" /> Table of contents
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">The six chapters</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Follow the spine from top to bottom and you’ll go from curious
            beginner to confident submitter — or jump to wherever your story is
            right now.
          </p>
        </div>

        <ol className="relative">
          {/* The book spine that ties the chapters together */}
          <span
            aria-hidden="true"
            className="absolute left-5 sm:left-6 top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-border to-primary/40"
          />

          {CHAPTERS.map(({ href, icon: Icon, chapter, label, title, opening, description, cta }, i) => (
            <li key={href} className="relative pl-16 sm:pl-20 pb-8 last:pb-0">
              {/* Chapter node on the spine */}
              <span className="absolute left-0 top-1 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground font-black text-lg shadow-sm ring-4 ring-background">
                {i + 1}
              </span>

              <Link
                to={href}
                className="block bg-card border border-border rounded-3xl p-7 sm:p-8 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{chapter}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
                  {i === 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Flag className="w-3 h-3" /> Start here
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex flex-shrink-0 w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm italic text-muted-foreground/90 mb-1.5">{opening}</p>
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{title}</h3>
                    <p className="text-muted-foreground mb-5 leading-relaxed">{description}</p>
                    <span className="inline-flex items-center gap-2 text-primary font-bold text-sm tracking-wide uppercase">
                      {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}

          {/* The destination marker — the happy ending */}
          <li className="relative pl-16 sm:pl-20">
            <span className="absolute left-0 top-1 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/15 ring-4 ring-background">
              <Flag className="w-5 h-5 text-primary" />
            </span>
            <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/[0.04] p-7">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">The happy ending</p>
              <p className="font-bold text-lg mb-1">You’re ready to submit. 🎉</p>
              <p className="text-muted-foreground leading-relaxed">
                With your slabs in hand, <Link to="/marketplace" className="text-primary font-semibold hover:underline">list them on the CardPop Marketplace</Link> — graded cards sell faster and for more.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Australian collector tips — the "field notes" appendix */}
      <section>
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
          <Sparkles className="w-4 h-4" /> Appendix
        </div>
        <h2 className="text-2xl font-bold mb-2">Field Notes for Australian Collectors</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Grading from Australia has unique considerations — costs, shipping, and service options differ from the US market.
          Keep these in your back pocket before you submit.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AU_TIPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
        </div>
        <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="px-7 py-6">
              <p className="font-bold mb-2">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Local Game Store CTA */}
      <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
          <Store className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Are you a Local Game Store?</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-7 leading-relaxed">
          Join the CardPop Retailer Network. Expand your reach, manage your inventory with our
          integrated tools, and connect with thousands of active Australian collectors.
        </p>
        <Button size="lg" className="w-full sm:w-auto px-10">Apply as Partner</Button>
      </section>

    </div>
  </div>
);

export default GradingPage;
