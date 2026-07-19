import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const OFFERINGS = [
  {
    title: 'Market Insights',
    desc: 'Discover pricing data and follow market trends as they move.',
  },
  {
    title: 'Grading & Resources',
    desc: 'Learn the hobby through grading guides and educational resources.',
  },
  {
    title: 'Collection Tracking',
    desc: 'Track your collection and research cards, all in one place.',
  },
  {
    title: 'A Real Community',
    desc: 'Connect with a growing community that shares the same passion.',
  },
];

const BELIEFS = [
  'The hobby is strongest when collectors trust one another.',
  'Knowledge should be shared, not hidden.',
  'Every collector deserves a safe, transparent place to buy and sell.',
  'Community is more important than transactions.',
  'Collecting should be fun, rewarding and welcoming for everyone.',
];

const AboutPage = () => {
  return (
    <>
      <SEOHead title="About CardPop™ | Australia's Trading Card Marketplace" description="CardPop™ is Australia's home for trading card collectors — recreating the trust, excitement and community of card shows online. Buy, sell, trade, learn and connect." />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-foreground text-background px-6 py-28 md:py-36">
        {/* Brand glow accents */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-red/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-red/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-[100rem] mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-7">
            <span className="w-2 h-2 rounded-full bg-brand-red" aria-hidden="true" />
            About CardPop™ · Buy. Sell. Collect.
          </span>
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] font-extrabold mb-6 max-w-3xl">
            The card show that<br />never <span className="text-brand-red">closes.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-xl opacity-70 mb-10">
            Every collector remembers the moment the hobby truly clicked. CardPop™
            was built to recreate the trust, excitement and community of card
            shows — online, every day of the year.
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
        <div className="max-w-[100rem] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16 items-start">
          {/* Story */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand-red">The Story</span>
            </div>
            <div className="space-y-5 text-[1.05rem] leading-[1.8] text-foreground">
              <p>
                For me, it wasn't pulling a rare card or landing a great deal. It was
                walking into my first card show.
              </p>
              <p>
                The energy was unlike anything I'd experienced before. Collectors swapping
                stories, making deals with a handshake, helping newcomers, celebrating each
                other's latest pickups, and vouching for people without hesitation. It wasn't
                just about buying and selling cards — it was about being part of a community
                built on trust.
              </p>
              <p>
                That experience stayed with me. As I spent more time in the hobby, I realised
                that feeling didn't always exist online. Outside of card shows, collectors were
                often left searching Facebook groups and Discord servers for vouches before
                every trade, hoping the person on the other end was genuine. Finding the right
                card was one challenge. Knowing who to trust was another.
              </p>
              <p>
                For high-value cards, that uncertainty isn't just frustrating — it can stop
                great deals from ever happening. I believed collecting deserved better.
                So I built CardPop™.
              </p>
              <p>
                Our goal is simple: recreate the trust, excitement and sense of community that
                makes card shows so special, and bring that experience online. Where duplicates
                find new homes with people who'll appreciate them. Where verified sellers give
                buyers real peace of mind. And where every transaction feels as comfortable as
                shaking hands across a table at your local card show.
              </p>
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

      {/* ── More than a marketplace ── */}
      <section className="bg-secondary/40 px-6 py-20 md:py-24">
        <div className="max-w-[100rem] mx-auto">
          <div className="max-w-2xl mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand-red">More Than A Marketplace</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Australia's home for trading card collectors
            </h2>
            <p className="text-[1.05rem] leading-[1.8] text-muted-foreground">
              A place to discover market insights, learn through grading guides and hobby
              resources, track your collection, research cards, follow trends and connect
              with a community that shares the same passion.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {OFFERINGS.map(({ title, desc }) => (
              <div key={title} className="group bg-card border border-border rounded-2xl p-8 transition-colors hover:border-brand-red/50">
                <div className="w-10 h-1 rounded-full bg-brand-red mb-5" aria-hidden="true" />
                <h3 className="font-bold text-lg mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Believe ── */}
      <section className="bg-foreground px-6 py-24">
        <div className="max-w-[100rem] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-background text-3xl font-extrabold mb-3">What we believe</h2>
            <p className="text-background/50 text-sm">
              The principles behind everything we build.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BELIEFS.map((belief, i) => (
              <div
                key={belief}
                className="bg-background/5 border border-background/10 rounded-2xl p-8"
              >
                <span className="block text-brand-red text-2xl font-extrabold mb-4" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-[0.95rem] text-background/80 leading-[1.7]">{belief}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built in Melbourne ── */}
      <section className="bg-background px-6 py-24">
        <div className="max-w-[820px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-red">Built in Melbourne</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-5">Built for collectors, by a collector</h2>
          <div className="space-y-5 text-[1.05rem] leading-[1.8] text-muted-foreground">
            <p>
              CardPop™ was founded in Melbourne by a collector who simply wanted the online
              hobby to feel more like the card shows that inspired it. We're collectors first,
              and that philosophy guides every decision we make.
            </p>
            <p>
              Whether we're building new tools, improving the marketplace or creating
              educational resources, our goal remains the same: help collectors spend less
              time worrying about who they can trust, and more time enjoying the hobby they love.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Parallel Report ── */}
      <section className="bg-secondary/40 px-6 py-24">
        <div className="max-w-[820px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-red">The Parallel Report</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-5">The research behind the report</h2>
          <div className="space-y-5 text-[1.05rem] leading-[1.8] text-muted-foreground">
            <p>
              The Parallel Report is CardPop™'s research desk — the market analysis, grading
              guides and investment insights you'll find on our blog. It isn't reheated press
              releases or recycled listicles.
            </p>
            <p>
              Every piece is grounded in personal research: hundreds of hours spent tracking
              real sales online and, just as importantly, talking with collectors, dealers and
              graders face-to-face at trade shows around Australia. That first-hand, on-the-floor
              perspective is why the guides focus on what actually matters to Australian
              collectors — real AUD costs, local submission routes, and the cards genuinely
              moving in this market.
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full px-7 font-bold mt-8">
            <Link to="/blog">Read The Parallel Report</Link>
          </Button>
        </div>
      </section>

      {/* ── Vision ── */}
      <section className="relative overflow-hidden bg-foreground text-background px-6 py-28">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-brand-red/15 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-[760px] mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-red">The Vision</span>
            <span className="w-10 h-1 rounded-full bg-brand-red" aria-hidden="true" />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-6">The card show that never closes</h2>
          <p className="text-[1.05rem] leading-[1.8] text-background/70 mb-5">
            A trusted place where collectors can buy, sell, learn, discover and connect —
            every day of the year.
          </p>
          <p className="text-[1.05rem] leading-[1.8] text-background/70 mb-10">
            Whether you're searching for your first rookie card, completing a lifelong
            collection, investing in the future of the hobby or simply enjoying the journey,
            we're grateful you've found us. Welcome to CardPop™.
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
