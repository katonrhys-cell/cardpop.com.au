import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    title: 'Community First',
    desc: 'Built around hobby culture, not just transactions.',
  },
  {
    title: 'Built for Collectors',
    desc: 'Every feature is designed for real collectors and traders.',
  },
  {
    title: 'Trusted Marketplace',
    desc: 'Secure listings, verified sellers, and transparency.',
  },
];

const TESTIMONIALS = [
  {
    quote: "I've traded cards online for years and always had that nagging doubt. CardPop™ completely changed that — sold a PSA 10 without a second thought.",
    name: 'Jake M.',
    location: 'Sydney, NSW',
  },
  {
    quote: "It genuinely feels like a card show online. The community vibe is real and everyone's been upfront. Found two grails in my first week.",
    name: 'Sarah T.',
    location: 'Brisbane, QLD',
  },
  {
    quote: "For high-value trades, peace of mind is everything. Knowing sellers are verified before I commit makes CardPop™ the only place I buy from now.",
    name: 'Chris W.',
    location: 'Perth, WA',
  },
];

const AboutPage = () => {
  return (
    <>
      <SEOHead title="About CardPop™ | Australia's Trading Card Marketplace" description="Learn about CardPop™ Australia — Australia's premier platform for buying, selling and trading Pokemon, Magic and sports cards." />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-foreground text-background px-6 py-28 md:py-36">
        {/* Brand glow accents */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-red/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-red/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-7">
            <span className="w-2 h-2 rounded-full bg-brand-red" aria-hidden="true" />
            CardPop™ Australia · Buy. Sell. Collect.
          </span>
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] font-extrabold mb-6 max-w-2xl">
            Built for the hobby.<br />Powered by <span className="text-brand-red">collectors.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-xl opacity-70 mb-10">
            CardPop™ Australia was created to bring the energy of card shows,
            trade nights, and collector culture into one trusted digital marketplace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7 font-bold">
              <Link to="/marketplace">Explore Marketplace</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full px-7 font-bold border-background/30 text-background bg-transparent hover:bg-background/10 hover:text-background hover:border-background/50"
            >
              <Link to="/signup">Join Community</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Founder Story ── */}
      <section className="bg-background px-6 py-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16 items-start">
          {/* Story */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand-red">The Story</span>
            </div>
            <div className="space-y-5 text-[1.05rem] leading-[1.8] text-foreground">
              <p>
                I'm a Melbourne-based collector who fell into the hobby and never looked back.
                But the more I got into it, the more I hit the same wall everyone else did —
                finding the right person to buy from was harder than it should be.
              </p>
              <p>
                Then I went to my first card show. The energy in that room was something else.
                People talking cards, making deals on a handshake, vouching for each other without
                a second thought. It was everything the hobby should feel like.
              </p>
              <p>
                Outside of those shows, though, that trust didn't really exist. I watched collectors
                chasing vouches across Discord servers and Facebook groups before every trade —
                never quite sure if the person on the other end was legitimate. For high-value cards,
                that uncertainty isn't just frustrating. It's a real barrier.
              </p>
              <p>
                CardPop™ was built to solve that. A place where cards can be shared, traded, and
                genuinely enjoyed — where your duplicates and seconds find new homes with people
                who'll love them just as much as you did. Where verified sellers give buyers real
                peace of mind. And where every transaction carries the same trust you'd feel shaking
                hands at a card show.
              </p>
              <p>The hobby wins when collectors can trust each other. That's what we're building.</p>
            </div>
          </div>

          {/* Founder card */}
          <div className="lg:sticky lg:top-24">
            <div className="relative rounded-3xl border border-border bg-card overflow-hidden shadow-xl">
              {/* Brand accent bar */}
              <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-red" aria-hidden="true" />
              <picture>
                <source
                  type="image/webp"
                  srcSet="/images/reece-conway-320.webp 320w, /images/reece-conway-640.webp 640w"
                  sizes="(max-width: 1024px) 100vw, 420px"
                />
                <img
                  src="/images/reece-conway-640.jpg"
                  srcSet="/images/reece-conway-320.jpg 320w, /images/reece-conway-640.jpg 640w"
                  sizes="(max-width: 1024px) 100vw, 420px"
                  alt="Reece Conway, founder of CardPop™ Australia"
                  className="w-full aspect-square object-cover"
                  width="640"
                  height="640"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <div className="p-6 border-t border-border">
                <p className="font-extrabold text-foreground text-lg leading-tight">Reece Conway</p>
                <p className="text-sm text-muted-foreground mt-1">Founder, CardPop™ Australia · Melbourne, Victoria</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-secondary/40 px-6 py-16 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ title, desc }) => (
            <div key={title} className="group bg-card border border-border rounded-2xl p-8 transition-colors hover:border-brand-red/50">
              <div className="w-10 h-1 rounded-full bg-brand-red mb-5" aria-hidden="true" />
              <h3 className="font-bold text-lg mb-3">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-foreground px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-background text-3xl font-extrabold mb-3">
              What collectors are saying
            </h2>
            <p className="text-background/50 text-sm">
              From Melbourne to Perth — the community speaks for itself.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ quote, name, location }) => (
              <div
                key={name}
                className="bg-background/5 border border-background/10 rounded-2xl p-8"
              >
                <span className="block text-brand-red text-5xl leading-none font-serif mb-2" aria-hidden="true">&ldquo;</span>
                <p className="text-sm text-background/75 leading-[1.75] mb-6">{quote}</p>
                <p className="font-bold text-background text-sm">{name}</p>
                <p className="text-xs text-background/40 mt-0.5">{location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision ── */}
      <section className="bg-background px-6 py-24">
        <div className="max-w-[760px] mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-red">What's Next</span>
            <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-extrabold mb-5">The future of collecting</h2>
          <p className="text-[1.05rem] leading-[1.8] text-muted-foreground mb-10">
            CardPop™ is building a connected ecosystem for collectors across
            Australia and beyond — one trusted trade at a time.
          </p>
          <Button asChild size="lg" className="rounded-full px-7 font-bold">
            <Link to="/marketplace">Start Collecting</Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
