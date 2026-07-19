import React, { useEffect, useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import {
  Rocket, ExternalLink, CheckCircle2, Info, Sparkles, TrendingUp,
  CreditCard, Mail, Radio, Facebook, Briefcase, Users, Globe, Store, Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Lucide icons an admin can reference by name from the `icon` column. Anything
// not in this map falls back to Sparkles, so adding a new tool never breaks the page.
const ICON_MAP = {
  CreditCard, Mail, Radio, Facebook, Briefcase, Users, Globe, Store,
  Megaphone, TrendingUp, Rocket, Sparkles,
};

// ─── Brand marks ──────────────────────────────────────────────────────────────
// Some tools read better as their real logo than a generic lucide glyph. Lucide
// dropped brand icons and these coloured marks aren't in any icon set, so they're
// inlined as SVGs (same approach as components/OAuthButtons.jsx). Single-colour
// marks take their colour from `currentColor` (driven by BRAND_ICONS.fill);
// multi-colour marks (Google, Whatnot) carry their own fills.
const StripeMark = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.007z" />
  </svg>
);

const GoogleMark = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// Whatnot's full app mark: a dark squircle with the yellow "w" showing through.
// Fills the whole tile (BRAND_ICONS.full), so the tile just needs a matching dark bg.
const WhatnotMark = ({ className }) => (
  <svg viewBox="0 0 115.16 115.16" className={className} aria-hidden="true">
    <path fill="#FFE505" d="M115.14,57.57c0,44.51-13.06,57.57-57.57,57.57S0,102.08,0,57.57,13.06,0,57.57,0s57.57,13.06,57.57,57.57" />
    <path fill="#292527" d="M57.58 0C13.06 0 0 13.06 0 57.58s13.06 57.58 57.58 57.58 57.58-13.06 57.58-57.58S102.1 0 57.58 0ZM89.5 65l-3.35 5.24C79.19 81.12 75.4 84.21 70.81 84.21c-4.85 0-7.49-2.38-13.97-12.87l-3.79-6.13c-.79-1.32-2.2-.75-1.85.75l.66 2.69c2.34 9.47-1.15 15.56-7.01 15.56-4.54 0-8.15-2.51-16-14.41l-3.26-4.94c-4.98-7.54-6.83-11.46-6.83-16.57 0-6.43 4.67-11.68 11.85-11.68 5.51 0 9.03 2.47 12.12 8.5l.79 1.54c.62 1.15 1.67 1.06 2.07 0l.57-1.5c2.2-5.77 5.77-8.55 11.37-8.55s9.34 2.78 11.5 8.55l.57 1.54c.4 1.01 1.54 1.1 2.07 0l.79-1.59c3.04-6.08 6.48-8.5 11.99-8.5 7.18 0 11.9 5.24 11.9 11.68 0 5.11-1.98 9.03-6.87 16.7Z" />
  </svg>
);

const KitMark = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="m3.5 11.633-2.434 2.408V8.687a.53.53 0 0 0-.533-.527.53.53 0 0 0-.533.527v6.624a.528.528 0 0 0 .532.526.533.533 0 0 0 .377-.153l2.974-2.939 2.974 2.94a.535.535 0 0 0 .754 0 .522.522 0 0 0 0-.746l-2.974-2.938L7.61 9.06a.522.522 0 0 0 0-.745.538.538 0 0 0-.753 0l-3.344 3.307c-.003 0-.005.003-.007.005l-.007.006v-.001zm8.826 4.206a.53.53 0 0 1-.533-.526V8.688a.53.53 0 0 1 .533-.528.53.53 0 0 1 .533.528v6.624a.53.53 0 0 1-.533.526v.001zm7.257-6.624v6.098c0 .29.238.526.532.526a.53.53 0 0 0 .533-.526V9.215h2.818A.53.53 0 0 0 24 8.688a.53.53 0 0 0-.533-.527h-6.702a.53.53 0 0 0-.533.527.53.53 0 0 0 .533.527h2.819-.001z" />
  </svg>
);

const InstagramMark = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
  </svg>
);

const MetaMark = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
  </svg>
);

const FacebookMark = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
  </svg>
);

// Instagram's official gradient — its glyph sits white on top of it.
const IG_GRADIENT = 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)';

// Brand names an admin can set in the `icon` column. Each carries its own tile
// background (`bg`, a CSS colour or gradient) and, for single-colour marks, a
// glyph colour (`fill`). `ring` adds a hairline for light tiles; `full` lets a
// self-contained mark (Whatnot) fill the tile edge-to-edge.
const BRAND_ICONS = {
  Stripe:    { Icon: StripeMark,    bg: 'linear-gradient(135deg,#6366f1,#9333ea)', fill: '#fff' },
  Google:    { Icon: GoogleMark,    bg: '#ffffff', ring: true },
  Whatnot:   { Icon: WhatnotMark,   bg: '#292527', full: true },
  Kit:       { Icon: KitMark,       bg: '#4b9cf5', fill: '#0a0a0a' },
  Instagram: { Icon: InstagramMark, bg: IG_GRADIENT, fill: '#fff' },
  Meta:      { Icon: MetaMark,      bg: '#ffffff', fill: '#0467df', ring: true },
  Facebook:  { Icon: FacebookMark,  bg: '#0866ff', fill: '#fff' },
};

// The organic-growth story: why using several tools together compounds.
const PILLARS = [
  {
    Icon: Megaphone,
    title: 'Show up everywhere',
    body: 'Socials for discovery, live selling for momentum, email for the audience you own. Each channel catches buyers the others miss.',
  },
  {
    Icon: TrendingUp,
    title: 'Feed one into the next',
    body: 'A Reel sends someone to your live show; the show sends them to your email list; the list brings them back to your next drop.',
  },
  {
    Icon: CheckCircle2,
    title: 'Look the part',
    body: 'A domain inbox and real card payments turn a hobby stall into a business people trust with bigger orders.',
  },
];

const BuildingYourBusinessPage = () => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('business_affiliate_links')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError('Unable to load recommendations right now.'); return; }
        setTools(data || []);
      })
      .catch(() => { if (!cancelled) setError('Unable to load recommendations right now.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <SEOHead
        title="Building Your Business | CardPop"
        description="The tools we use and recommend to grow a trading card business in Australia — payments, live selling, email, socials and more. A multi-pronged approach to organically build your presence."
        canonicalUrl="https://cardpop.com.au/community/building-your-business"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://cardpop.com.au/' },
            { '@type': 'ListItem', position: 2, name: 'Community', item: 'https://cardpop.com.au/community' },
            { '@type': 'ListItem', position: 3, name: 'Building Your Business', item: 'https://cardpop.com.au/community/building-your-business' },
          ],
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-charcoal text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-red/40 via-brand-charcoal to-brand-charcoal pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-brand-red/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center shadow-lg shadow-brand-red/30">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">For sellers &amp; hobby businesses</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Building Your Business</h1>
          <p className="text-white/70 text-lg max-w-2xl leading-relaxed">
            The tools we actually use to run CardPop — and how each one can help you grow your own card business,
            whether you sell at shows, go live, or move stock online. No single app builds a following.
            A <span className="text-white font-semibold">multi-pronged approach</span> does — each channel feeding the
            next until your presence grows on its own.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">
        {/* The approach */}
        <section>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground mb-3">Why a multi-pronged approach wins</h2>
          <p className="text-muted-foreground max-w-2xl mb-8 leading-relaxed">
            Every collector you want to reach is somewhere different — scrolling Instagram, watching a live break,
            hunting a Facebook group, or checking their inbox. Cover more of those places and the same effort reaches
            more people. Better still, the channels compound: attention in one becomes a sale in another, and repeat
            buyers turn into the organic word-of-mouth that grows a business without paying for every click.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {PILLARS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Affiliate disclosure */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p>
            <span className="font-semibold text-foreground">Heads up:</span> some links below are affiliate or
            referral links. If you sign up through them we may earn a small commission or credit — at no extra cost
            to you. We only list tools we genuinely use to run CardPop.
          </p>
        </div>

        {/* Tools */}
        <section>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-foreground mb-8">The toolkit we recommend</h2>

          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-14 h-14 rounded-2xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-40" />
                </div>
              ))}
            </div>
          ) : tools.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-10 text-center text-muted-foreground">
              Recommendations are coming soon.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {tools.map((tool) => {
                const brand = BRAND_ICONS[tool.icon];
                const Icon = ICON_MAP[tool.icon] || Sparkles;
                return (
                  <article key={tool.id} className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
                          brand ? '' : `bg-gradient-to-br ${tool.accent || 'from-brand-red to-brand-blue'}`
                        }`}
                        style={brand ? {
                          background: brand.bg,
                          ...(brand.ring ? { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)' } : {}),
                        } : undefined}
                      >
                        {tool.logo_url ? (
                          <img src={tool.logo_url} alt={tool.name} className="w-full h-full object-contain p-2" loading="lazy" />
                        ) : brand ? (
                          <brand.Icon
                            className={brand.full ? 'w-full h-full' : 'w-7 h-7'}
                            style={brand.fill ? { color: brand.fill } : undefined}
                          />
                        ) : (
                          <Icon className="w-7 h-7 text-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">{tool.name}</h3>
                          {tool.category && (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">{tool.category}</Badge>
                          )}
                        </div>
                        {tool.tagline && <p className="text-sm text-muted-foreground mt-0.5">{tool.tagline}</p>}
                        {tool.badge && (
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {tool.badge}
                          </div>
                        )}
                      </div>
                    </div>

                    {tool.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{tool.description}</p>
                    )}

                    <div className="space-y-3 mb-5">
                      {tool.why_i_use_it && (
                        <div className="rounded-xl bg-muted/40 p-3.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-1">Why we use it</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{tool.why_i_use_it}</p>
                        </div>
                      )}
                      {tool.how_it_helps_you && (
                        <div className="rounded-xl bg-primary/5 border border-primary/10 p-3.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">How it helps your card business</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{tool.how_it_helps_you}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-1">
                      <Button asChild className="rounded-xl font-bold">
                        <a href={tool.affiliate_url} target="_blank" rel="sponsored noopener noreferrer">
                          {tool.cta_label || 'Learn more'}
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Closing note */}
        <section className="rounded-2xl border border-border bg-gradient-to-br from-muted/50 to-transparent p-8 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-2">Start with one, then stack</h2>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            You don't need all of these on day one. Pick the gap that's costing you sales, set it up, then add the
            next. Over time they weave together into a presence that keeps growing while you sleep — and every buyer
            you win is one you can reach again.
          </p>
        </section>
      </div>
    </div>
  );
};

export default BuildingYourBusinessPage;
