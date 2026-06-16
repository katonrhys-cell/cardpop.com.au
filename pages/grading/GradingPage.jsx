import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import {
  SearchCheck, BookOpen, BarChart2, Building2, ArrowRight,
  Store, ShieldCheck, DollarSign, Clock, MapPin, HelpCircle, TrendingUp, Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SECTIONS = [
  {
    href: '/grading/what-is-grading',
    icon: BookOpen,
    title: 'What is Card Grading?',
    description:
      'New to grading? Start here. Learn what professional card grading is, how the process works, and why Australian collectors are grading more than ever.',
    cta: 'READ GUIDE',
  },
  {
    href: '/grading/scales',
    icon: BarChart2,
    title: 'Grading Scales Explained',
    description:
      'Understand the 1–10 condition scales used by every major grading company. Know exactly what separates a Gem Mint 10 from a Mint 9 before you submit.',
    cta: 'VIEW SCALES',
  },
  {
    href: '/grading/companies',
    icon: Building2,
    title: 'Grading Companies',
    description:
      'Compare PSA, BGS, CGC, ACE Grading and more. Find turnaround times, Australian pricing, and which service suits your cards and budget.',
    cta: 'COMPARE SERVICES',
  },
  {
    href: '/grading/local',
    icon: MapPin,
    title: 'Submit Locally with Trusted Graders',
    description:
      'Skip international shipping and customs. Ranked local Australian grading services for TCG and sports cards, plus the best PSA and Beckett submission partners in Australia.',
    cta: 'VIEW LOCAL OPTIONS',
  },
  {
    href: '/grading/estimator',
    icon: Calculator,
    title: 'Grade Estimator',
    description:
      'Upload photos of your card and receive AI-generated preliminary grade estimates across PSA, BGS, CGC, ACE, and SGC. A helpful guide before you commit to a professional submission.',
    cta: 'TRY ESTIMATOR',
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

    {/* Hero */}
    <section className="bg-card border-b border-border py-20 text-center">
      <div className="container-default">
        <SearchCheck className="w-12 h-12 text-primary mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Grading Hub</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Australia's home for trading card grading knowledge. Understand the scales,
          compare grading services, and make smarter decisions about your collection.
        </p>
      </div>
    </section>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

      {/* Core resource cards */}
      <div className="space-y-4">
        {SECTIONS.map(({ href, icon: Icon, title, description, cta }) => (
          <Link
            key={href}
            to={href}
            className="block bg-card border border-border rounded-3xl p-8 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
            <span className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
              {cta} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ))}
      </div>

      {/* Australian collector tips */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Grading Tips for Australian Collectors</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Grading from Australia has unique considerations — costs, shipping, and service options differ from the US market.
          Here's what you need to know before submitting.
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
