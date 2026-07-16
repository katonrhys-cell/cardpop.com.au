
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, TrendingUp, Search, Users, Package, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { cachedQuery } from '@/lib/queryCache.js';
import VaultListingCard from '@/components/VaultListingCard.jsx';
import SellerCard from '@/components/SellerCard.jsx';
import FeaturedSellerCard from '@/components/FeaturedSellerCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchActiveShowcaseCards } from '@/lib/heroShowcase.js';

// NOTE: this page intentionally imports NOTHING from framer-motion. The library
// costs ~110 kB of JS and ~1.5 s of main-thread execution on a mid-range phone
// (it was the top "Reduce JavaScript execution time" and "Forced reflow" culprit
// in PageSpeed Insights). All entrance animations below are plain CSS
// (see "HOMEPAGE ENTRANCE ANIMATIONS" in index.css) triggered by a tiny
// IntersectionObserver hook. The animated hero showcase still uses
// framer-motion, but it is desktop-only, so it's lazy-loaded behind a
// matchMedia gate and phones never download it.
const HeroCardShowcase = lazy(() => import('@/components/HeroCardShowcase.jsx'));

import { HOMEPAGE_CATEGORIES } from '@/components/CategoryIcons.jsx';

// ─── In-view reveal (framer-motion whileInView replacement) ─────────────────
// Returns [ref, inView]; inView flips to true once the element scrolls within
// rootMargin of the viewport and stays true (equivalent to viewport.once).
const useRevealOnce = (rootMargin = '-60px') => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, inView];
};

// ─── Animated counter ────────────────────────────────────────────────────────
const useCountUp = (end, inView, isDecimal = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const totalFrames = 45;
    const timer = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = isDecimal ? +(end * eased).toFixed(1) : Math.floor(end * eased);
      setCount(current);
      if (frame >= totalFrames) {
        setCount(end);
        clearInterval(timer);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, inView, isDecimal]);
  return count;
};


// ─── Static data ──────────────────────────────────────────────────────────────
const STATS = [
  { value: 12400, suffix: '+', label: 'Cards Listed' },
  { value: 850,   suffix: '+', label: 'Verified Sellers' },
  { value: 3200,  suffix: '+', label: 'Trades Completed' },
  { value: 4.9,   suffix: '★', label: 'Average Rating', isDecimal: true },
];

const TRUST_SIGNALS = [
  {
    icon: ShieldCheck,
    title: 'Secure payments',
    body: 'Processed by Stripe on a PCI-DSS checkout — your card details never touch our servers.',
  },
  {
    icon: CheckCircle2,
    title: 'ID-verified members',
    body: 'Sellers confirm their identity with Stripe Identity, so you only trade with verified people.',
  },
  {
    icon: Package,
    title: '14-day buyer protection',
    body: 'A full refund if your item never arrives or isn\'t as described.',
  },
];

const CATEGORIES = HOMEPAGE_CATEGORIES;

const HOW_IT_WORKS = [
  {
    step: '01', icon: Package,
    title: 'List Your Cards',
    desc: 'Add cards to your vault in seconds. Set prices, conditions, and trade preferences with ease.',
  },
  {
    step: '02', icon: Search,
    title: 'Find or Get Found',
    desc: 'Smart search connects you with buyers and sellers across Australia in real time.',
  },
  {
    step: '03', icon: ShieldCheck,
    title: 'Trade Safely',
    desc: 'Pay securely through Stripe and shop with our 14-day Buyer Protection — a full refund if your item never arrives or isn\'t as described.',
  },
];

const ACTIVITY_FEED = [
  { user: '@PokeTrader_SYD',   action: 'sold a PSA 10 Charizard Base Set',    price: '$2,400', time: '2m ago' },
  { user: '@MTG_Melbourne',    action: 'listed a Dual Land Alpha',             price: '$5,200', time: '5m ago' },
  { user: '@SportsCardsBris',  action: 'completed a trade — Rookie Gretzky',  price: '$950',   time: '9m ago' },
  { user: '@PokeFan_Perth',    action: 'sold a Shadowless Blastoise',          price: '$620',   time: '12m ago' },
  { user: '@CardKing_ADE',     action: 'listed 3× PSA 9 Venusaur',            price: '$1,100', time: '18m ago' },
  { user: '@YuGiOh_GLD',       action: 'sold a Dark Magician 1st Edition',    price: '$340',   time: '21m ago' },
  { user: '@LorcanaMaster',    action: 'completed trade — Rare Sorcerers',    price: '$210',   time: '25m ago' },
  { user: '@BrisbaneBaller',   action: 'sold a 2023 Panini LeBron SSP',       price: '$480',   time: '31m ago' },
];

// ─── Hero floating card shapes ────────────────────────────────────────────────
const HERO_CARDS = [
  {
    image: '/images/hero/black-lotus',
    gradient: 'from-stone-800 via-stone-900 to-black',
    borderColor: 'border-yellow-600/60',
    rotate: -16, x: -200, y: 30, delay: 0, floatY: -12,
    name: 'Black Lotus',
    set: 'Magic: The Gathering',
    year: '1993 · Alpha',
    rarity: 'PSA 9 MINT',
    value: '$500,000+',
  },
  {
    image: '/images/hero/michael-jordan',
    gradient: 'from-red-800 via-red-900 to-black',
    borderColor: 'border-red-400/50',
    rotate: -8, x: -100, y: -15, delay: 0.12, floatY: -16,
    name: 'Michael Jordan',
    set: 'Fleer Basketball',
    year: '1986 · #57 RC',
    rarity: 'Rookie Card',
    value: '$738,000',
  },
  {
    image: '/images/hero/ohtani-rookie',
    gradient: 'from-blue-800 via-blue-900 to-red-900',
    borderColor: 'border-blue-300/50',
    rotate: 0, x: 0, y: 10, delay: 0.24, floatY: -10,
    name: 'Shohei Ohtani',
    set: 'Topps Chrome',
    year: '2018 · Rookie Auto',
    rarity: 'PSA/DNA Auto 10',
    value: '$200,000+',
  },
  {
    image: '/images/hero/lebron-james',
    gradient: 'from-purple-800 via-purple-900 to-black',
    borderColor: 'border-purple-400/50',
    rotate: 8, x: 100, y: 5, delay: 0.36, floatY: -14,
    name: 'LeBron James',
    set: 'Topps Chrome',
    year: '2003 · #111 RC',
    rarity: 'Rookie Card',
    value: '$5,200,000',
  },
  {
    image: '/images/hero/pikachu-illustrator',
    gradient: 'from-yellow-400 via-yellow-500 to-amber-500',
    borderColor: 'border-yellow-200/70',
    rotate: 16, x: 200, y: 35, delay: 0.48, floatY: -14,
    name: 'Pikachu Illustrator',
    set: 'Pokémon',
    year: '1998 · CoroCoro',
    rarity: 'PSA 9 MINT',
    value: '$5,300,000',
  },
];

// ─── Stat counter item ────────────────────────────────────────────────────────
const StatItem = ({ value, suffix, label, isDecimal, inView }) => {
  const count = useCountUp(value, inView, isDecimal);
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-extrabold font-serif text-foreground tabular-nums">
        {count}{suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const HomePage = () => {
  const [featuredCards, setFeaturedCards]     = useState([]);
  const [featuredSellers, setFeaturedSellers] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [heroCards, setHeroCards]             = useState(HERO_CARDS);

  const DESK_VISIBLE = 8;
  const total = CATEGORIES.length;
  // Continuous sliding track: render the full list with a DESK_VISIBLE-wide
  // buffer of duplicated tiles on each side so rotating in either direction
  // slides the icons smoothly instead of remounting the row (which made every
  // tile flash from opacity 0 on each click). `deskPos` is the logical start
  // index; it may briefly overshoot into a buffer, then snaps back
  // (transition-free) once the slide settles, giving a seamless loop.
  const deskLoop = [
    ...CATEGORIES.slice(total - DESK_VISIBLE),
    ...CATEGORIES,
    ...CATEGORIES.slice(0, DESK_VISIBLE),
  ];
  const DESK_N = deskLoop.length;      // total + 2 * DESK_VISIBLE
  const deskStep = 100 / DESK_N;       // width of one tile, as a % of the track
  const [deskPos, setDeskPos] = useState(0);
  const [deskInstant, setDeskInstant] = useState(false);

  // After a transition-free snap back into range, re-enable the transition on
  // the next frame so the following click animates again.
  useEffect(() => {
    if (!deskInstant) return;
    const id = requestAnimationFrame(() => setDeskInstant(false));
    return () => cancelAnimationFrame(id);
  }, [deskInstant]);

  const goDeskNext = () => setDeskPos(p => p + 1);
  const goDeskPrev = () => setDeskPos(p => p - 1);
  const onDeskSlideEnd = (e) => {
    // Only react to the track's own transform slide, not bubbled hover
    // transitions from the tiles inside it.
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
    if (deskPos >= total)  { setDeskInstant(true); setDeskPos(p => p - total); }
    else if (deskPos < 0)  { setDeskInstant(true); setDeskPos(p => p + total); }
  };

  const [tickerIdx, setTickerIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTickerIdx(i => (i + 1) % ACTIVITY_FEED.length), 4000);
    return () => clearInterval(id);
  }, []);

  const [statsRef, statsInView] = useRevealOnce('-80px');
  const [categoriesRef, categoriesInView] = useRevealOnce('0px');
  const [howRef, howInView] = useRevealOnce('-60px');
  const [cardsRef, cardsInView] = useRevealOnce('-100px');
  const [sellersRef, sellersInView] = useRevealOnce('-100px');

  // The animated hero showcase is hidden below lg (CSS `hidden lg:block`), so
  // only desktop viewports pay for its chunk (and framer-motion inside it).
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        // Use 5-minute cache for homepage data (user sees fresh content on repeat visits)
        const [listingsRes, sellersRes] = await Promise.all([
          cachedQuery('homepage_featured_cards', async () => {
            // vault_items has more than one FK to profiles, so the embed must use
            // the explicit constraint-name hint (!vault_items_owner_id_fkey) —
            // the bare !owner_id hint returns a PostgREST 400.
            const SELECT = '*, owner:profiles!vault_items_owner_id_fkey(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count), vault_images(*)';
            const LIMIT = 4;
            // Fresh builder per call — a Supabase query builder is single-use.
            const base = () => supabase.from('vault_items').select(SELECT).eq('is_public', true).neq('listing_type', 'Private');

            // Admin-curated picks (Marketplace Management → Featured) come first.
            const featuredRes = await base().eq('is_featured', true).order('created_at', { ascending: false }).limit(LIMIT);
            if (featuredRes.error) return featuredRes;
            const featured = featuredRes.data ?? [];
            if (featured.length >= LIMIT) return { data: featured.slice(0, LIMIT), error: null };

            // Backfill with the most recent cards so the grid is never emptier
            // than before curation existed (empty selection = previous behaviour).
            const fillRes = await base().order('created_at', { ascending: false }).limit(LIMIT + featured.length);
            if (fillRes.error) return { data: featured, error: null };
            const seen = new Set(featured.map(c => c.id));
            const backfill = (fillRes.data ?? []).filter(c => !seen.has(c.id));
            return { data: [...featured, ...backfill].slice(0, LIMIT), error: null };
          },
            5 * 60 * 1000
          ),
          cachedQuery('homepage_featured_sellers', () =>
            supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('is_featured_seller', true).eq('is_active', true).limit(4),
            5 * 60 * 1000
          ),
        ]);

        // Supabase resolves with { data, error } instead of throwing — an
        // unlogged error here renders the empty state with no trace, which
        // makes "cards aren't loading" reports undiagnosable from the field.
        if (listingsRes?.error) console.error('[HomePage] featured cards query failed:', listingsRes.error);
        if (sellersRes?.error) console.error('[HomePage] featured sellers query failed:', sellersRes.error);

        if (isMounted) {
          setFeaturedCards(listingsRes.data ?? []);

          // Deduplicate sellers by user id to prevent duplicates
          const seen = new Set();
          const uniqueSellers = (sellersRes.data ?? []).filter(seller => {
            if (seen.has(seller.id)) return false;
            seen.add(seller.id);
            return true;
          });

          setFeaturedSellers(uniqueSellers);
        }
      } catch (error) {
        console.error('[HomePage] home data fetch failed:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Fire immediately: effects already run after the first paint, and the
    // query cost is network wait, not main-thread work. Deferring this to
    // requestIdleCallback (with its 2s timeout) meant the Supabase round-trip
    // only STARTED after all chunk parsing settled — the skeleton sections
    // were the last thing to resolve by a wide margin.
    fetchHomeData();

    return () => { isMounted = false; };
  }, []);

  // Hero showcase cards are admin-configurable; fall back to the built-in set.
  // Skipped on mobile — the showcase never renders there, so the query would
  // be wasted work.
  useEffect(() => {
    if (!isDesktop) return undefined;
    let isMounted = true;
    fetchActiveShowcaseCards().then((cards) => {
      if (isMounted && cards.length > 0) setHeroCards(cards);
    });
    return () => { isMounted = false; };
  }, [isDesktop]);

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden">
      <SEOHead
        title="CardPop™ | Australia's Trading Card Marketplace"
        description="Buy, sell, and trade Pokémon, Magic: The Gathering, sports cards and more on CardPop™ Australia — Australia's most trusted trading card platform."
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92dvh] flex items-start justify-center pt-10 sm:pt-14 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden bg-zinc-950">

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

        {/* Spotlight beam — left */}
        <div
          className="absolute top-0 left-[18%] w-72 h-full pointer-events-none origin-top"
          style={{
            background: 'linear-gradient(180deg, rgba(255,220,100,0.12) 0%, transparent 68%)',
            filter: 'blur(32px)',
            animation: 'spotlight-drift 8s ease-in-out infinite',
          }}
        />
        {/* Spotlight beam — centre */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-full pointer-events-none origin-top"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 60%)',
            filter: 'blur(48px)',
          }}
        />
        {/* Spotlight beam — right */}
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

        {/* ── Animated card showcase — shelf → stand (desktop only) ── */}
        {isDesktop && (
          <Suspense fallback={null}>
            <HeroCardShowcase cards={heroCards} />
          </Suspense>
        )}

        {/* ── Hero text ── */}
        <div className="max-w-5xl mx-auto w-full relative z-10 lg:pr-[460px] xl:pr-[480px]">
          {/* NOTE: the hero text block is intentionally NOT wrapped in a
              motion fade. It contains the LCP <h1>, which must paint the moment
              HomePage renders — gating it behind a framer-motion opacity:0→1
              animation delayed LCP until the JS loaded and the tween ran. Only
              the small, non-LCP badge and trust chips animate below. */}
          <div className="text-center lg:text-left">
            {/* LIVE show badge */}
            <div
              className="anim-pop-in inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8 border text-sm font-black tracking-wider uppercase"
              style={{
                animationDelay: '0.15s',
                background: 'rgba(220,38,38,0.12)',
                borderColor: 'rgba(220,38,38,0.35)',
                color: '#f87171',
                boxShadow: '0 0 24px rgba(220,38,38,0.2)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              CardPop™ Live
              <span className="text-white/30 font-normal">·</span>
              <span className="text-white/60 font-semibold normal-case tracking-normal">Australia's Card Show</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-[4.25rem] font-bold font-serif tracking-normal text-balance mb-6 leading-[1.2] text-white">
              The Card Show{' '}
              <br className="hidden sm:block" />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg, #fbbf24 0%, #f87171 45%, #a78bfa 100%)' }}
              >
                That Never Closes
              </span>
            </h1>

            <p className="text-base md:text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed text-balance mx-auto lg:mx-0">
              Pokémon&nbsp;·&nbsp;MTG&nbsp;·&nbsp;Sports&nbsp;·&nbsp;More — buy, sell and trade with verified Australian collectors. Real prices, AUD only, buyer protection on every order.
            </p>

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
                  Browse the Show <ArrowRight className="ml-2 w-5 h-5" />
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
                <Link to="/signup">
                  Open Your Vault
                </Link>
              </Button>
            </div>

            {/* Trust chips */}
            <div
              className="anim-fade-in flex flex-wrap items-center justify-center lg:justify-start gap-3"
              style={{ animationDelay: '0.5s' }}
            >
              {[
                { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: 'Buyer Protected' },
                { icon: <Zap className="w-3.5 h-3.5" />, label: 'AUD Pricing' },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Live Market Data' },
              ].map(({ icon, label }) => (
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

        {/* ── Live price ticker strip at hero bottom ── */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden border-t" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)' }}>
          <div className="py-2.5 px-6 flex items-center justify-center" style={{ height: '32px' }}>
            {/* Keyed remount replays the CSS enter animation on every rotation */}
              <div
                key={tickerIdx}
                className="anim-ticker-in flex items-center gap-2 text-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                <span className="font-bold text-zinc-200">{ACTIVITY_FEED[tickerIdx].user}</span>
                <span className="text-zinc-500">{ACTIVITY_FEED[tickerIdx].action}</span>
                <span className="font-black text-yellow-400">{ACTIVITY_FEED[tickerIdx].price}</span>
                <span className="text-zinc-600">{ACTIVITY_FEED[tickerIdx].time}</span>
              </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-12 border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {STATS.map((stat) => (
              <StatItem key={stat.label} {...stat} inView={statsInView} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      <section className="py-10 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TRUST_SIGNALS.map(({ icon: Icon, title, body }) => (
              <Link
                key={title}
                to="/trust-safety"
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <div className="leading-snug">
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/trust-safety" className="font-semibold text-primary hover:underline">
              See how we keep every trade safe <ArrowRight className="inline h-3 w-3 align-[-1px]" />
            </Link>
          </p>
        </div>
      </section>

      {/* ── Category browse ───────────────────────────────────────────────── */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold font-serif mb-1">Browse by Category</h2>
              <p className="text-muted-foreground text-sm">Find exactly what you collect.</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex font-bold text-sm hover:bg-muted">
              <Link to="/marketplace">All categories <ArrowRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </div>

          {/* Mobile: touch swipe through all 24 */}
          <div ref={categoriesRef} className="sm:hidden flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
            {CATEGORIES.map((cat, i) => (
              <div
                key={cat.name}
                className={`flex-shrink-0 snap-start w-32 ${categoriesInView ? 'anim-reveal-up' : 'opacity-0'}`}
                style={categoriesInView ? { animationDuration: '0.2s', animationDelay: `${Math.min(i, 8) * 0.03}s` } : undefined}
              >
                <Link
                  to={cat.slug ? `/collections/${cat.slug}` : '/marketplace'}
                  className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${cat.gradient} aspect-square shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-center leading-tight`}
                >
                  <cat.Icon className="w-9 h-9 drop-shadow-sm" />
                  <span className="text-[11px] font-bold leading-tight text-white drop-shadow-sm">{cat.name}</span>
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop: single-row arrow carousel */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={goDeskPrev}
              aria-label="Previous categories"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-hidden">
              {/* Continuous track — translates one tile per click. Nothing
                  remounts, so the icons slide across instead of flashing. */}
              <div
                className={`flex cat-carousel-track${deskInstant ? ' cat-carousel-track--instant' : ''}`}
                style={{
                  width: `${(DESK_N / DESK_VISIBLE) * 100}%`,
                  transform: `translateX(-${(deskPos + DESK_VISIBLE) * deskStep}%)`,
                }}
                onTransitionEnd={onDeskSlideEnd}
              >
                {deskLoop.map((cat, i) => (
                  <div
                    key={`${cat.slug}-${i}`}
                    className="px-2"
                    style={{ width: `${deskStep}%`, flexShrink: 0 }}
                  >
                    <Link
                      to={cat.slug ? `/collections/${cat.slug}` : '/marketplace'}
                      className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${cat.gradient} aspect-square shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-center leading-tight`}
                    >
                      <cat.Icon className="w-9 h-9 drop-shadow-sm" />
                      <span className="text-[11px] font-bold leading-tight text-white drop-shadow-sm">{cat.name}</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={goDeskNext}
              aria-label="Next categories"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Bento features ───────────────────────────────────────────────── */}
      <section className="py-24 bg-card border-y border-border relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">Built for Serious Collectors</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to manage your collection and make informed trades.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)]">
            {/* Large feature */}
            <div className="md:col-span-2 bg-secondary rounded-3xl p-8 md:p-12 flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10 max-w-md">
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-secondary-foreground">Bank-Grade Security</h3>
                <p className="text-secondary-foreground/80 leading-relaxed">
                  Payments are processed securely through Stripe, and every order is covered by our 14-day Buyer Protection Guarantee — a full refund if an item doesn't arrive or isn't as described.
                </p>
              </div>
              <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-gradient-to-tl from-primary/10 to-transparent rounded-tl-full transition-transform duration-500 group-hover:scale-110" />
            </div>

            {/* Small feature 1 */}
            <div className="bg-muted rounded-3xl p-8 flex flex-col justify-between group hover:bg-muted/80 transition-colors">
              <div>
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Live Market Data</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Track real-time price movements and historical sales data to ensure you always get fair value.
                </p>
              </div>
            </div>

            {/* Small feature 2 */}
            <div className="bg-muted rounded-3xl p-8 flex flex-col justify-between group hover:bg-muted/80 transition-colors">
              <div>
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-6 shadow-sm">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Smart Discovery</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Find exactly what you're looking for with our advanced filtering and AI-powered search engine.
                </p>
              </div>
            </div>

            {/* CTA feature */}
            <div className="md:col-span-2 bg-primary text-primary-foreground rounded-3xl p-8 md:p-12 flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden">
              <div className="relative z-10 max-w-md">
                <h3 className="text-2xl md:text-3xl font-bold mb-4">Ready to start trading?</h3>
                <p className="text-primary-foreground/90 mb-8">
                  Join our community of verified collectors and start building your dream vault today.
                </p>
                <Button asChild variant="secondary" size="lg" className="rounded-xl font-bold text-primary hover:bg-background">
                  <Link to="/signup">Get Started Now</Link>
                </Button>
              </div>
              <div className="relative z-10 w-32 h-32 sm:w-48 sm:h-48 bg-primary-foreground/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary-foreground/20">
                <Users className="w-16 h-16 sm:w-24 sm:h-24 text-primary-foreground/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">How CardPop Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Three simple steps to start trading with confidence across Australia.
            </p>
          </div>

          <div ref={howRef} className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 z-0" />

            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className={`relative z-10 flex flex-col items-center text-center ${howInView ? 'anim-reveal-up' : 'opacity-0'}`}
                style={howInView ? { animationDelay: `${i * 0.15}s` } : undefined}
              >
                {/* Step number badge */}
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-lg shadow-primary/20 relative">
                  <step.icon className="w-9 h-9 text-primary-foreground" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border-2 border-border text-[10px] font-extrabold text-muted-foreground flex items-center justify-center">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3 font-serif">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-bold text-lg shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5">
              <Link to="/signup">Start for Free <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Featured cards ────────────────────────────────────────────────── */}
      <section className="py-24 bg-muted/30 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold font-serif mb-2">Featured Cards</h2>
              <p className="text-muted-foreground">Handpicked listings from Australian collectors.</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:flex font-bold hover:bg-muted">
              <Link to="/marketplace">View All <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredCards.length > 0 ? (
            <div
              ref={cardsRef}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {featuredCards.map((card, i) => (
                <div
                  key={card.id}
                  className={cardsInView ? 'anim-reveal-up' : 'opacity-0'}
                  style={cardsInView ? { animationDelay: `${i * 0.1}s` } : undefined}
                >
                  <VaultListingCard vaultItem={card} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-background rounded-3xl border border-border">
              <p className="text-muted-foreground font-medium">No recent cards available at the moment.</p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Button asChild variant="outline" className="w-full rounded-xl font-bold">
              <Link to="/marketplace">View All Listings</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Community activity marquee ────────────────────────────────────── */}
      <section className="py-14 bg-foreground overflow-hidden">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 text-background/60 text-sm font-semibold tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live Activity
          </span>
        </div>

        {/* Marquee wrapper — CSS animation via inline style */}
        <div className="relative">
          <div
            className="flex gap-4 w-max"
            style={{ animation: 'marquee 40s linear infinite' }}
          >
            {[...ACTIVITY_FEED, ...ACTIVITY_FEED].map((item, i) => (
              <div
                key={i}
                className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl bg-background/[0.07] border border-background/10 text-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-bold text-background/90">{item.user}</span>
                <span className="text-background/60">{item.action}</span>
                <span className="font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-lg">{item.price}</span>
                <span className="text-background/70 text-xs">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured sellers ──────────────────────────────────────────────── */}
      <section className="py-24 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-serif mb-4">Trusted Australian Sellers</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Trade with confidence. Every seller is verified and rated by the CardPop community.</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-64 w-full rounded-3xl" />
              ))}
            </div>
          ) : featuredSellers.length > 0 ? (
            <div
              ref={sellersRef}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {featuredSellers.map((seller, i) => (
                <div
                  key={seller.id}
                  className={sellersInView ? 'anim-reveal-up' : 'opacity-0'}
                  style={sellersInView ? { animationDelay: `${i * 0.1}s` } : undefined}
                >
                  <FeaturedSellerCard seller={seller} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted rounded-3xl border border-border shadow-sm">
              <p className="text-muted-foreground font-medium">Seller profiles are currently being updated.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
