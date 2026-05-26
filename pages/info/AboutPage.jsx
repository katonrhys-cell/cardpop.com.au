import React from 'react';
import { Helmet } from 'react-helmet';
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
    quote: "I've traded cards online for years and always had that nagging doubt. CardPop completely changed that — sold a PSA 10 without a second thought.",
    name: 'Jake M.',
    location: 'Sydney, NSW',
  },
  {
    quote: "It genuinely feels like a card show online. The community vibe is real and everyone's been upfront. Found two grails in my first week.",
    name: 'Sarah T.',
    location: 'Brisbane, QLD',
  },
  {
    quote: "For high-value trades, peace of mind is everything. Knowing sellers are verified before I commit makes CardPop the only place I buy from now.",
    name: 'Chris W.',
    location: 'Perth, WA',
  },
];

const AboutPage = () => {
  return (
    <>
      <Helmet>
        <title>About Us | CardPop</title>
        <meta
          name="description"
          content="CardPop Australia was created to bring the energy of card shows, trade nights, and collector culture into one trusted digital marketplace."
        />
      </Helmet>

      {/* ── Hero ── */}
      <section className="bg-foreground text-background px-6 py-28 md:py-36">
        <div className="max-w-6xl mx-auto">
          <span className="inline-block text-primary text-[0.7rem] font-bold tracking-[0.16em] uppercase mb-5">
            About CardPop Australia
          </span>
          <h1 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] font-extrabold mb-6 max-w-2xl">
            Built for the hobby.<br />Powered by collectors.
          </h1>
          <p className="text-lg leading-relaxed max-w-xl opacity-70 mb-10">
            CardPop Australia was created to bring the energy of card shows,
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
        <div className="max-w-[760px] mx-auto">
          <span className="block font-heading font-extrabold text-[5.5rem] leading-[0.7] text-primary mb-8 select-none">
            "
          </span>
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
              CardPop was built to solve that. A place where cards can be shared, traded, and
              genuinely enjoyed — where your duplicates and seconds find new homes with people
              who'll love them just as much as you did. Where verified sellers give buyers real
              peace of mind. And where every transaction carries the same trust you'd feel shaking
              hands at a card show.
            </p>
            <p>The hobby wins when collectors can trust each other. That's what we're building.</p>
          </div>

          <div className="flex items-center gap-4 mt-10 pt-8 border-t border-border">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-heading font-extrabold text-base flex items-center justify-center shrink-0">
              K
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Katon</p>
              <p className="text-xs text-muted-foreground mt-0.5">Founder, CardPop · Melbourne, VIC</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-secondary/40 px-6 py-16 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-8">
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
                <span className="block font-heading font-extrabold text-primary text-3xl leading-none mb-4">
                  "
                </span>
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
        <div className="max-w-[760px] mx-auto">
          <h2 className="text-3xl font-extrabold mb-5">The future of collecting</h2>
          <p className="text-[1.05rem] leading-[1.8] text-muted-foreground">
            CardPop is building a connected ecosystem for collectors across
            Australia and beyond — one trusted trade at a time.
          </p>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
