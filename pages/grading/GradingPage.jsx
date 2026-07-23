import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import {
  BookOpen, BarChart2, Building2, ArrowRight,
  Store, ShieldCheck, DollarSign, Clock, MapPin, TrendingUp, Calculator,
  BookMarked, Flag, BookText, Compass, Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';

// The grading journey, told as a book: Learn → Understand → Decide → Preview → Choose → Submit.
// Each chapter is a page on a connected path so collectors always know where they are and what's next.
const CHAPTERS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
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

    {/* Hero — the book cover / title page */}
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-card to-background py-20 sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(var(--primary)/0.15) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="container-default relative">
        {/* The book */}
        <div className="mx-auto max-w-md">
          <div className="relative rounded-r-2xl rounded-l-md border border-border bg-card px-8 py-12 text-center shadow-xl">
            {/* Book spine */}
            <span aria-hidden="true" className="absolute inset-y-3 left-0 w-2 rounded-l-md bg-gradient-to-b from-primary to-primary/60" />
            <span aria-hidden="true" className="absolute inset-y-3 left-2.5 w-px bg-border" />

            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <BookMarked className="h-3.5 w-3.5" /> A CardPop Handbook
            </div>

            <BookText className="mx-auto mt-7 h-12 w-12 text-primary" />

            <h1 className="mt-5 font-serif text-4xl font-bold leading-tight sm:text-5xl">
              The Grading<br />Handbook
            </h1>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              An Australian collector's story — from your very first raw card to a
              sealed, graded slab. Read it cover to cover, one chapter at a time.
            </p>
            <div className="mt-7 flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
              <span className="h-px w-6 bg-border" /> Six chapters <span className="h-px w-6 bg-border" />
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/grading/what-is-grading"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
          >
            Start your journey <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#contents"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-8 py-3.5 text-sm font-bold transition-colors hover:border-primary/50 sm:w-auto"
          >
            Browse the contents
          </a>
        </div>
      </div>
    </section>

    <div className="container-default space-y-16 py-12">

      {/* Table of contents — the map at a glance */}
      <section id="contents" className="scroll-mt-8">
        <div className="mb-6 flex items-center gap-3">
          <BookMarked className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-2xl font-bold sm:text-3xl">Chapters</h2>
        </div>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHAPTERS.map(({ href, icon: Icon, title, label }, i) => (
            <li key={href}>
              <a
                href={`#chapter-${i + 1}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/5 font-serif text-lg font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    Chapter {i + 1}
                  </span>
                </div>
                <Icon className="mb-3 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <p className="font-bold leading-tight group-hover:text-primary">{title}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                  Read <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* The chapters — a connected, numbered path you walk down */}
      <section>
        <div className="mb-10 text-center">
          <h2 className="font-serif text-2xl font-bold sm:text-3xl">Your grading story, chapter by chapter</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Six chapters take you from curious beginner to confident submitter. Read them in
            order, or turn straight to wherever you are on your journey.
          </p>
        </div>

        <ol className="relative">
          {/* The book spine that ties the chapters together */}
          <span
            aria-hidden="true"
            className="absolute left-5 top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-border to-primary/40 sm:left-6"
          />

          {CHAPTERS.map(({ href, icon: Icon, label, title, description, cta }, i) => (
            <li key={href} id={`chapter-${i + 1}`} className="relative scroll-mt-8 pb-8 pl-16 last:pb-0 sm:pl-20">
              {/* Chapter node on the path */}
              <span className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-serif text-lg font-black text-primary-foreground shadow-sm ring-4 ring-background sm:h-12 sm:w-12">
                {i + 1}
              </span>

              <Link
                to={href}
                className="group block rounded-3xl border border-border bg-card p-7 transition-all hover:border-primary/50 hover:shadow-md sm:p-8"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">Chapter {i + 1}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
                  {i === 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Flag className="h-3 w-3" /> Start here
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  <div className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 sm:flex">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-serif text-xl font-bold transition-colors group-hover:text-primary sm:text-2xl">{title}</h3>
                    <p className="mb-5 leading-relaxed text-muted-foreground">{description}</p>
                    <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                      {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}

          {/* The destination marker — the happy ending */}
          <li className="relative pl-16 sm:pl-20">
            <span className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-4 ring-background sm:h-12 sm:w-12">
              <Flag className="h-5 w-5 text-primary" />
            </span>
            <div className="pt-2">
              <p className="font-serif text-lg font-bold">The End — you're ready to submit. 🎉</p>
              <p className="text-muted-foreground">
                With your slabs in hand, <Link to="/marketplace" className="font-semibold text-primary hover:underline">list them on the CardPop Marketplace</Link> — graded cards sell faster and for more.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Australian collector tips — the "field notes" appendix */}
      <section>
        <h2 className="mb-2 font-serif text-2xl font-bold">Appendix: Field Notes for Australian Collectors</h2>
        <p className="mb-6 leading-relaxed text-muted-foreground">
          Grading from Australia has unique considerations — costs, shipping, and service options differ from the US market.
          Keep these in your back pocket before you submit.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {AU_TIPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — collapsible, like flipping through an index */}
      <section>
        <h2 className="mb-6 font-serif text-2xl font-bold">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full overflow-hidden rounded-3xl border border-border bg-card px-2 sm:px-4">
          {FAQS.map(({ q, a }, i) => (
            <AccordionItem key={q} value={`faq-${i}`} className="px-3 last:border-b-0">
              <AccordionTrigger className="text-left font-bold">{q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Local Game Store CTA */}
      <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
          <Store className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mb-3 font-serif text-2xl font-bold">Are you a Local Game Store?</h2>
        <p className="mx-auto mb-7 max-w-md leading-relaxed text-muted-foreground">
          Join the CardPop Retailer Network. Expand your reach, manage your inventory with our
          integrated tools, and connect with thousands of active Australian collectors.
        </p>
        <Button size="lg" asChild className="w-full px-10 sm:w-auto">
          <Link to="/partners">Apply as Partner</Link>
        </Button>
      </section>

    </div>
  </div>
);

export default GradingPage;
