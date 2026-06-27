import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import {
  BookOpen, BarChart2, Building2, ArrowRight,
  Store, ShieldCheck, DollarSign, Clock, MapPin, TrendingUp, Calculator,
  Flag, BookMarked, Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';

// The grading journey, told as a book: each chapter is a page on one connected story.
// Learn → Understand → Decide → Preview → Choose → Submit. Collectors always know
// which chapter they're on and what the next page holds.
const CHAPTERS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
    numeral: 'One',
    label: 'Start your journey',
    title: 'What is Card Grading?',
    teaser: 'Once upon a raw card…',
    description:
      'New to grading? Begin here. Learn what professional card grading is, how the process works, and why Australian collectors are grading more than ever.',
    cta: 'Read the guide',
    minutes: '4 min read',
  },
  {
    href: '/grading/scales',
    icon: BarChart2,
    numeral: 'Two',
    label: 'Learn the language',
    title: 'Grading Scales Explained',
    teaser: 'Speak the grader’s language',
    description:
      'Understand the 1–10 condition scales used by every major grading company. Know exactly what separates a Gem Mint 10 from a Mint 9 before you submit.',
    cta: 'View the scales',
    minutes: '5 min read',
  },
  {
    href: '/grading/roi-calculator',
    icon: TrendingUp,
    numeral: 'Three',
    label: 'Decide if it’s worth it',
    title: 'Grading ROI Calculator',
    teaser: 'Is the prize worth the journey?',
    description:
      'Is grading worth it for your card? Enter your card, raw cost, and grading service for a probability-weighted expected return powered by live eBay AU prices and full cost breakdowns.',
    cta: 'Calculate ROI',
    minutes: 'Interactive',
  },
  {
    href: '/grading/estimator',
    icon: Calculator,
    numeral: 'Four',
    label: 'Preview your grade',
    title: 'Grade Estimator',
    teaser: 'A glimpse of the ending',
    description:
      'Upload photos of your card and receive AI-generated preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC — a helpful guide before you commit to a professional submission.',
    cta: 'Try the estimator',
    minutes: 'Interactive',
  },
  {
    href: '/grading/companies',
    icon: Building2,
    numeral: 'Five',
    label: 'Choose your grader',
    title: 'Grading Companies',
    teaser: 'Choose your guide',
    description:
      'Compare PSA, BGS, CGC, ACE Grading and more. Find turnaround times, Australian pricing, and which service suits your cards and your budget.',
    cta: 'Compare services',
    minutes: '6 min read',
  },
  {
    href: '/grading/submission-partners',
    icon: MapPin,
    numeral: 'Six',
    label: 'Submit your cards',
    title: 'Submit Locally with Trusted Graders',
    teaser: 'The journey’s end',
    description:
      'Reach the destination. Skip international shipping and customs with ranked local Australian grading services, plus the best PSA and Beckett submission partners in Australia.',
    cta: 'View local options',
    minutes: '4 min read',
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

    {/* ──────────────────────────────────────────────────────────────
        Book cover — the hero is the cover of the guide. A spine runs
        down the left edge so it reads unmistakably as a book.
       ────────────────────────────────────────────────────────────── */}
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/40 to-background py-16 sm:py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="container-default relative">
        <div className="mx-auto max-w-2xl">
          {/* The book itself */}
          <div className="relative rounded-r-2xl rounded-l-md bg-card border border-border shadow-2xl overflow-hidden">
            {/* spine */}
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-b from-primary via-primary/80 to-primary" />
            <span aria-hidden="true" className="absolute inset-y-0 left-2.5 w-px bg-border" />

            <div className="pl-10 pr-8 sm:pl-14 sm:pr-12 py-12 sm:py-16 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary mb-7">
                <BookMarked className="w-3.5 h-3.5" /> A CardPop Field Guide
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                The Grading Story
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                From your very first raw card to a sealed, graded slab — one path,
                six chapters. Turn the page and we'll walk it with you, from the
                basics all the way to submitting with confidence.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/grading/what-is-grading"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Open to Chapter One <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#contents"
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-border bg-background px-8 py-3 text-sm font-semibold text-foreground hover:border-primary/50 transition-colors"
                >
                  <Compass className="w-4 h-4" /> Table of contents
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-20">

      {/* ──────────────────────────────────────────────────────────────
          Table of contents — the opening page of the book. Makes the
          starting point obvious and lets readers jump anywhere.
         ────────────────────────────────────────────────────────────── */}
      <section id="contents" className="scroll-mt-8">
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Contents</h2>
          <span className="text-xs text-muted-foreground">Six chapters</span>
        </div>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {CHAPTERS.map(({ href, numeral, title, label }, i) => (
            <Link
              key={href}
              to={href}
              className="group flex items-center gap-4 px-5 sm:px-7 py-4 hover:bg-muted/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              <span className="flex-shrink-0 w-8 text-center font-black text-primary/70 group-hover:text-primary transition-colors">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate group-hover:text-primary transition-colors">
                  <span className="text-muted-foreground font-medium">Chapter {numeral} — </span>{title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{label}</p>
              </div>
              {i === 0 && (
                <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Flag className="w-3 h-3" /> Start here
                </span>
              )}
              <ArrowRight className="w-4 h-4 flex-shrink-0 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          The story — a connected, numbered path of chapters.
         ────────────────────────────────────────────────────────────── */}
      <section id="journey" className="scroll-mt-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Follow the path</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Read it cover to cover, or open straight to wherever you are on your journey.
            Each chapter leads naturally into the next.
          </p>
        </div>

        <ol className="relative">
          {/* The connecting line — the thread of the story */}
          <span
            aria-hidden="true"
            className="absolute left-5 sm:left-6 top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-border to-primary/40"
          />

          {CHAPTERS.map(({ href, icon: Icon, numeral, label, title, teaser, description, cta, minutes }, i) => (
            <li key={href} className="relative pl-16 sm:pl-20 pb-8 last:pb-0">
              {/* Chapter node on the path */}
              <span className="absolute left-0 top-1 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground font-black text-lg shadow-sm ring-4 ring-background">
                {i + 1}
              </span>

              <Link
                to={href}
                className="block bg-card border border-border rounded-3xl p-7 sm:p-8 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Chapter {numeral}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Clock className="w-3 h-3" /> {minutes}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex flex-shrink-0 w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm italic text-muted-foreground mb-1">{teaser}</p>
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
            <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-7 sm:p-8">
              <p className="font-bold text-lg mb-1">The End — and a new beginning. 🎉</p>
              <p className="text-muted-foreground leading-relaxed">
                With your slabs in hand, <Link to="/marketplace" className="text-primary font-semibold hover:underline">list them on the CardPop Marketplace</Link> — graded cards sell faster and for more.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Australian collector tips — the "field notes" appendix */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Appendix — Field Notes for Australian Collectors</h2>
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

      {/* FAQ — an accordion so the page stays calm and scannable */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="bg-card border border-border rounded-3xl px-7 divide-y divide-border">
          {FAQS.map(({ q, a }) => (
            <AccordionItem key={q} value={q} className="border-b-0 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
              <AccordionTrigger className="text-base font-bold no-underline hover:no-underline py-5">{q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
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
