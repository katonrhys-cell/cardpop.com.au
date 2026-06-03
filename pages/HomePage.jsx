
import React, { useState, useEffect, useRef } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap, TrendingUp, Search, Users, Package, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient.js';
import VaultListingCard from '@/components/VaultListingCard.jsx';
import SellerCard from '@/components/SellerCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

import { HOMEPAGE_CATEGORIES } from '@/components/CategoryIcons.jsx';

// ─── Animated counter ────────────────────────────────────────────────────────
const useCountUp = (end, inView, isDecimal = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const totalFrames = 90;
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
    desc: 'Our escrow system protects every deal. Funds release only when both parties are satisfied.',
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
    image: '/images/hero/black-lotus-1024.jpg',
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
    image: '/images/hero/michael-jordan-1024.jpg',
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
    image: '/images/hero/ohtani-rookie-1024.jpg',
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
    image: '/images/hero/lebron-james-1024.jpg',
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
    image: '/images/hero/pikachu-illustrator-1024.jpg',
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

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// ─── Component ────────────────────────────────────────────────────────────────
const HomePage = () => {
  const [featuredCards, setFeaturedCards]     = useState([]);
  const [featuredSellers, setFeaturedSellers] = useState([]);
  const [loading, setLoading]                 = useState(true);

  const statsRef   = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' });

  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        const [listingsRes, sellersRes] = await Promise.all([
          supabase.from('vault_items').select('*, owner:profiles!owner_id(id, display_name, username, avatar_url), vault_images(*)').eq('is_public', true).in('listing_type', ['fixed', 'trade', 'both']).order('created_at', { ascending: false }).limit(4),
          supabase.from('profiles').select('*').eq('is_featured_seller', true).eq('is_active', true).limit(4),
        ]);

        if (isMounted) {
          setFeaturedCards(listingsRes.data ?? []);
          setFeaturedSellers(sellersRes.data ?? []);
        }
      } catch (error) {
        console.error('Failed to fetch homepage data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHomeData();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans overflow-hidden">
      <SEOHead
        title="CardPop | Australia's Trading Card Marketplace"
        description="Buy, sell, and trade Pokémon, Magic: The Gathering, sports cards and more on CardPop — Australia's most trusted trading card platform."
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92dvh] flex items-center justify-center pt-20 pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-soft-light bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />

        {/* Gradient orbs */}
        <div className="absolute top-1/3 -left-32 w-[32rem] h-[32rem] bg-primary/15 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-[28rem] h-[28rem] bg-blue-500/10 rounded-full blur-3xl -z-10" />

        {/* Floating card stack — desktop only */}
        <div className="absolute right-[2%] xl:right-[5%] top-1/2 -translate-y-1/2 hidden lg:block w-[520px] h-[420px] pointer-events-none select-none">
          {HERO_CARDS.map((card, i) => (
            <motion.div
              key={i}
              className={`absolute w-44 h-60 rounded-2xl bg-gradient-to-br ${card.gradient} shadow-2xl border ${card.borderColor} overflow-hidden`}
              style={{ left: '50%', top: '50%', marginLeft: -88, marginTop: -120 }}
              initial={{ opacity: 0, scale: 0.85, rotate: card.rotate, x: card.x, y: card.y + 40 }}
              animate={{
                opacity: 1,
                scale: 1,
                rotate: card.rotate,
                x: card.x,
                y: [card.y, card.y + card.floatY, card.y],
              }}
              transition={{
                opacity: { duration: 0.5, delay: card.delay },
                scale:   { duration: 0.5, delay: card.delay },
                y: {
                  duration: 3.5 + i * 0.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: card.delay + 0.5,
                },
              }}
            >
              {/* Shine overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20 pointer-events-none z-10" />

              {card.image ? (
                /* Real PSA slab photo */
                <img
                  src={card.image}
                  alt={`${card.name} ${card.rarity}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <>
                  {/* Card name bar */}
                  <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${card.accent} px-2 py-1 flex items-center justify-between`}>
                    <span className="text-[8px] font-black text-white truncate leading-tight">{card.name}</span>
                    <span className={`text-[10px] font-bold ${card.symbolColor}`}>{card.symbol}</span>
                  </div>
                  {/* Art box */}
                  <div className={`absolute top-6 left-2 right-2 h-24 rounded-lg ${card.artColor} flex items-center justify-center shadow-inner`}>
                    <span className="text-4xl drop-shadow-lg">{card.artEmoji}</span>
                  </div>
                  {/* Card info */}
                  <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-1">
                    <div className="text-[7px] font-bold text-white/60 uppercase tracking-wider mb-0.5">{card.rarity}</div>
                    <div className="text-[7px] text-white/50 leading-tight">{card.set}</div>
                    <div className="text-[7px] text-white/40 leading-tight mb-1">{card.year}</div>
                    <div className={`text-[9px] font-black bg-gradient-to-r ${card.accent} bg-clip-text text-transparent`}>{card.value}</div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* Hero text — offset left on desktop to make room for cards */}
        <div className="max-w-5xl mx-auto w-full relative z-10 lg:pr-[440px] xl:pr-[460px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-bold tracking-wide mb-8 border border-border shadow-sm">
              <Zap className="w-4 h-4 text-primary" />
              Australia's Trading Card Marketplace
            </span>

            <h1 className="text-5xl md:text-7xl lg:text-7xl font-extrabold font-serif tracking-tight text-balance mb-8 leading-[1.08]">
              Buy, Sell &amp; Trade Cards{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                Across Australia
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-12 leading-relaxed text-balance mx-auto lg:mx-0">
              The safest place to buy, sell and trade Pokémon, Magic, sports cards and more — with Australian sellers, AUD pricing, and real-time market data.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold text-lg shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5">
                <Link to="/marketplace">
                  Explore Marketplace <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold text-lg border-2 hover:bg-muted transition-all">
                <Link to="/signup">
                  Create Free Vault
                </Link>
              </Button>
            </div>
          </motion.div>
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

          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 sm:overflow-visible sm:pb-0">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex-shrink-0 snap-start w-32 sm:w-auto"
              >
                <Link
                  to={cat.slug ? `/collections/${cat.slug}` : '/marketplace'}
                  className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${cat.gradient} aspect-square shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-center leading-tight`}
                >
                  <cat.Icon className="w-9 h-9 drop-shadow-sm" />
                  <span className="text-[11px] font-bold leading-tight text-white drop-shadow-sm">{cat.name}</span>
                </Link>
              </motion.div>
            ))}
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
                  Every transaction is protected by our advanced escrow system. Funds are only released when both parties are completely satisfied with the trade.
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 z-0" />

            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative z-10 flex flex-col items-center text-center"
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
              </motion.div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-bold text-lg shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5">
              <Link to="/signup">Start for Free <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Recent vault additions ────────────────────────────────────────── */}
      <section className="py-24 bg-muted/30 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold font-serif mb-2">Recent Vault Additions</h2>
              <p className="text-muted-foreground">Fresh listings from Australian collectors.</p>
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
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {featuredCards.map(card => (
                <motion.div key={card.id} variants={itemVariants}>
                  <VaultListingCard listing={card} />
                </motion.div>
              ))}
            </motion.div>
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
                <span className="font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-lg">{item.price}</span>
                <span className="text-background/40 text-xs">{item.time}</span>
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
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {featuredSellers.map(seller => (
                <motion.div key={seller.id} variants={itemVariants}>
                  <SellerCard seller={seller} />
                </motion.div>
              ))}
            </motion.div>
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
