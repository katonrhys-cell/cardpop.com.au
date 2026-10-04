import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Eager, framer-motion-FREE hero. This is the homepage's LCP content (the <h1>).
// It is rendered THREE ways that must stay visually identical so the Largest
// Contentful Paint element never moves or re-paints:
//   1. the static HTML shell baked into index.html (tools/home-shell.html),
//   2. the Suspense fallback for the "/" route while HomePage lazy-loads (App.jsx),
//   3. the top of the real HomePage once its chunk arrives.
// Because it avoids framer-motion, it renders on React's first commit and stays
// out of the lazy homepage/animation chunks. If you change the copy or markup
// here, mirror it in tools/home-shell.html and pages/HomePage.jsx.
//
// The hero speaks to BUYERS first: a marketplace needs demand to show its
// sellers, and most visitors arrive wanting a card. Search is the primary
// action, "Shop cards" the filled button, "Sell for free" the secondary.
const TRUST = [
  { icon: <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Buyer Protection on every order' },
  { icon: <Zap className="w-3.5 h-3.5" aria-hidden="true" />, label: 'AUD prices, Australian sellers' },
  { icon: <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Live market data' },
];

export const HERO_SEARCH_PLACEHOLDER = 'Search Charizard, Black Lotus, Luka Dončić rookie…';

// Plain form (no SearchBar dependency) so the eager hero stays tiny; the
// results page handles suggestions, spelling and empty states.
export const HeroSearchForm = ({ className = '' }) => {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={`flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-1.5 backdrop-blur-sm focus-within:border-white/40 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get('q');
        const query = typeof q === 'string' ? q.trim() : '';
        if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
        else navigate('/marketplace');
      }}
    >
      <Search className="ml-3 h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
      <input
        type="search"
        name="q"
        aria-label="Search cards"
        placeholder={HERO_SEARCH_PLACEHOLDER}
        autoComplete="off"
        className="h-11 min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-zinc-500 focus:outline-none"
      />
      <Button type="submit" className="h-11 shrink-0 rounded-xl px-5 font-bold" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', color: '#fff', border: 'none' }}>
        Search
      </Button>
    </form>
  );
};

const HeroSection = () => {
  return (
    <section className="relative min-h-[92dvh] flex items-start justify-center pt-10 sm:pt-14 pb-16 px-5 sm:px-8 lg:px-12 xl:px-16 overflow-hidden bg-zinc-950">

      {/* Stage floor gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-[#0f0f14] to-zinc-950 pointer-events-none" />

      {/* Subtle grid lines — convention-hall floor feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Spotlight beams */}
      <div
        className="absolute top-0 left-[18%] w-72 h-full pointer-events-none origin-top"
        style={{
          background: 'linear-gradient(180deg, rgba(255,220,100,0.12) 0%, transparent 68%)',
          filter: 'blur(32px)',
          animation: 'spotlight-drift 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-full pointer-events-none origin-top"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 60%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        className="absolute top-0 right-[15%] w-64 h-full pointer-events-none origin-top"
        style={{
          background: 'linear-gradient(180deg, rgba(180,100,255,0.10) 0%, transparent 65%)',
          filter: 'blur(28px)',
          animation: 'spotlight-drift-r 10s ease-in-out infinite',
        }}
      />

      {/* Atmospheric glows */}
      <div className="absolute top-1/3 right-[28%] w-[36rem] h-[36rem] bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-[10%] w-[28rem] h-[28rem] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto w-full relative z-10 lg:pr-[460px] xl:pr-[480px]">
        <div className="text-center lg:text-left">
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8 border text-sm font-black tracking-wider uppercase"
            style={{
              background: 'rgba(220,38,38,0.12)',
              borderColor: 'rgba(220,38,38,0.35)',
              color: '#f87171',
              boxShadow: '0 0 24px rgba(220,38,38,0.2)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            CardPop™
            <span className="text-white/30 font-normal">·</span>
            <span className="text-white/60 font-semibold normal-case tracking-normal">Australia's Trading Card Marketplace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold font-serif tracking-normal text-balance mb-6 leading-[1.2] text-white">
            Buy and Sell Trading Cards{' '}
            <br className="hidden sm:block" />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #fbbf24 0%, #f87171 45%, #a78bfa 100%)' }}
            >
              with Collectors Across Australia
            </span>
          </h1>

          <p className="text-base md:text-lg text-zinc-400 max-w-lg mb-8 leading-relaxed text-balance mx-auto lg:mx-0">
            Pokémon, Magic, sports cards and more from verified Australian sellers — priced in AUD, paid securely, and covered by Buyer Protection on every order. Selling is free.
          </p>

          <div className="mb-6 flex justify-center lg:justify-start">
            <HeroSearchForm />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-14 px-8 rounded-2xl font-black text-lg transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                boxShadow: '0 8px 32px rgba(220,38,38,0.4)',
                color: '#fff',
                border: 'none',
              }}
            >
              <Link to="/marketplace">
                Shop Cards <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold text-lg transition-all hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                color: '#e4e4e7',
              }}
            >
              <Link to="/signup?next=%2Fvault%2Fadd">
                Sell for Free
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
            {TRUST.map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#a1a1aa' }}
              >
                {icon}{label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
