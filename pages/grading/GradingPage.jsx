import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import {
  SearchCheck, BookOpen, BarChart2, Building2, ArrowRight,
  Store, ShieldCheck, DollarSign, Clock, MapPin, HelpCircle, TrendingUp, Calculator,
  Sparkles, Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// The grading journey, told as a story: Learn → Understand → Decide → Preview → Choose → Submit.
// Each chapter is a step on a connected path so collectors always know where they are and what's next.
const CHAPTERS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
    chapter: 'Chapter 1',
    label: 'Start your journey',
    title: 'What is Card Grading?',
    description:
      'New to grading? Begin here. Learn what professional card grading is, how the process works, and why Australian collectors are grading more than ever.',
    cta: 'Read the guide',
  },
  {
    href: '/grading/scales',
    icon: BarChart2,
    chapter: 'Chapter 2',
    label: 'Learn the language',
    title: 'Grading Scales Explained',
    description:
      'Understand the 1–10 condition scales used by every major grading company. Know exactly what separates a Gem Mint 10 from a Mint 9 before you submit.',
    cta: 'View the scales',
  },
  {
    href: '/grading/roi-calculator',
    icon: TrendingUp,
    chapter: 'Chapter 3',
    label: 'Decide if it’s worth it',
    title: 'Grading ROI Calculator',
    description:
      'Is grading worth it for your card? Enter your card, raw cost, and grading service for a probability-weighted expected return powered by live eBay AU prices and full cost breakdowns.',
    cta: 'Calculate ROI',
  },
  {
    href: '/grading/estimator',
    icon: Calculator,
    chapter: 'Chapter 4',
    label: 'Preview your grade',
    title: 'Grade Estimator',
    description:
      'Upload photos of your card and receive AI-generated preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC — a helpful guide before you commit to a professional submission.',
    cta: 'Try the estimator',
  },
  {
    href: '/grading/companies',
    icon: Building2,
    chapter: 'Chapter 5',
    label: 'Choose your grader',
    title: 'Grading Companies',
    description:
      'Compare PSA, BGS, CGC, ACE Grading and more. Find turnaround times, Australian pricing, and which service suits your cards and your budget.',
    cta: 'Compare services',
  },
  {
    href: '/grading/local',
    icon: MapPin,
    chapter: 'Chapter 6',
    label: 'Submit your cards',
    title: 'Submit Locally with Trusted Graders',
    description:
      'Reach the destination. Skip international shipping and customs with ranked local Australian grading services, plus the best PSA and Beckett submission partners in Australia.',
    cta: 'View local options',
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

    {/* Hero — sets the scene for the journey */}
    <section className="relative overflow-hidden bg-card border-b border-border py-20 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="container-default relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Your grading journey
        </div>
        <SearchCheck className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">The Grading Hub</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          From your very first raw card to a sealed, graded slab — follow the path below
          chapter by chapter. We'll guide you from understanding the basics all the way
          to submitting with confidence.
        </p>
        <a
          href="#journey"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Start at Chapter 1 <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">

      {/* The journey — a connected, numbered path of chapters */}
      <section id="journey" className="scroll-mt-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Follow the path</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Six chapters take you from curious beginner to confident submitter. Read them in
            order, or jump to wherever you are on your journey.
          </p>
        </div>

        <ol className="relative">
          {/* The connecting line that ties the chapters together */}
          <span
            aria-hidden="true"
            className="absolute left-5 sm:left-6 top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-border to-primary/40"
          />

          {CHAPTERS.map(({ href, icon: Icon, chapter, label, title, description, cta }, i) => (
            <li key={href} className="relative pl-16 sm:pl-20 pb-8 last:pb-0">
              {/* Chapter node on the path */}
              <span className="absolute left-0 top-1 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground font-black text-lg shadow-sm ring-4 ring-background">
                {i + 1}
              </span>

              <Link
                to={href}
                className="block bg-card border border-border rounded-3xl p-7 sm:p-8 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">{chapter}</span>
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
            <div className="pt-2">
              <p className="font-bold text-lg">You're ready to submit. 🎉</p>
              <p className="text-muted-foreground">
                With your slabs in hand, <Link to="/marketplace" className="text-primary font-semibold hover:underline">list them on the CardPop Marketplace</Link> — graded cards sell faster and for more.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Australian collector tips — the "field notes" appendix */}
      <section>
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
