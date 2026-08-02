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

// ─── Brand logos ──────────────────────────────────────────────────────────────
// Each recommended tool shows its real, full logo — the brand mark plus wordmark
// on the same coloured background the brand uses — rather than a generic lucide
// glyph. Lucide dropped brand icons and full-logo lockups aren't in any icon set,
// so they're inlined as SVGs (same approach as components/OAuthButtons.jsx). The
// marks are exact brand paths; the wordmarks are set in the brand's own colours.
// Every logo renders into the same uniform rectangular tile (see the tools grid
// below) and is contained edge-to-edge, so they all sit at one consistent size.
//
// Prefer a real image when an admin sets `logo_url` — that overrides the inline
// lockup and drops into the identical tile.
const WORDMARK_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Stripe — white "stripe" wordmark on Stripe's indigo (#635bff).
const StripeLogo = ({ className }) => (
  <svg viewBox="0 0 132 48" className={className} aria-hidden="true">
    <text x="66" y="37" textAnchor="middle" fontFamily={WORDMARK_FONT} fontWeight="800" fontSize="40" letterSpacing="-2.5" fill="#ffffff">stripe</text>
  </svg>
);

// Google Workspace — the multi-colour "Google" wordmark + grey "Workspace".
const GoogleWorkspaceLogo = ({ className }) => (
  <svg viewBox="0 0 372 48" className={className} aria-hidden="true">
    <text y="37" fontFamily={WORDMARK_FONT} fontWeight="500" fontSize="40" letterSpacing="-1">
      <tspan x="0" fill="#4285F4">G</tspan>
      <tspan fill="#EA4335">o</tspan>
      <tspan fill="#FBBC05">o</tspan>
      <tspan fill="#4285F4">g</tspan>
      <tspan fill="#34A853">l</tspan>
      <tspan fill="#EA4335">e</tspan>
      <tspan dx="16" fill="#5f6368">Workspace</tspan>
    </text>
  </svg>
);

// Whatnot — the dark squircle mark (yellow "w" showing through the tile) + the
// black "whatnot" wordmark, on Whatnot yellow.
const WhatnotLogo = ({ className }) => (
  <svg viewBox="0 0 214 48" className={className} aria-hidden="true">
    <g transform="translate(0 2) scale(0.38207)">
      <path fill="#111111" d="M57.58 0C13.06 0 0 13.06 0 57.58s13.06 57.58 57.58 57.58 57.58-13.06 57.58-57.58S102.1 0 57.58 0ZM89.5 65l-3.35 5.24C79.19 81.12 75.4 84.21 70.81 84.21c-4.85 0-7.49-2.38-13.97-12.87l-3.79-6.13c-.79-1.32-2.2-.75-1.85.75l.66 2.69c2.34 9.47-1.15 15.56-7.01 15.56-4.54 0-8.15-2.51-16-14.41l-3.26-4.94c-4.98-7.54-6.83-11.46-6.83-16.57 0-6.43 4.67-11.68 11.85-11.68 5.51 0 9.03 2.47 12.12 8.5l.79 1.54c.62 1.15 1.67 1.06 2.07 0l.57-1.5c2.2-5.77 5.77-8.55 11.37-8.55s9.34 2.78 11.5 8.55l.57 1.54c.4 1.01 1.54 1.1 2.07 0l.79-1.59c3.04-6.08 6.48-8.5 11.99-8.5 7.18 0 11.9 5.24 11.9 11.68 0 5.11-1.98 9.03-6.87 16.7Z" />
    </g>
    <text x="54" y="35" fontFamily={WORDMARK_FONT} fontWeight="800" fontSize="36" letterSpacing="-1.5" fill="#111111">whatnot</text>
  </svg>
);

// Kit — the black "kit" wordmark on Kit's blue.
const KitLogo = ({ className }) => (
  <svg viewBox="0 0 78 48" className={className} aria-hidden="true">
    <text x="39" y="37" textAnchor="middle" fontFamily={WORDMARK_FONT} fontWeight="800" fontSize="42" letterSpacing="-2" fill="#0a0a0a">kit</text>
  </svg>
);

// Meta — the blue infinity mark (its brand gradient) + the dark "Meta" wordmark.
const MetaLogo = ({ className }) => (
  <svg viewBox="0 0 146 48" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="cp-meta-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0064e0" />
        <stop offset="1" stopColor="#00b2ff" />
      </linearGradient>
    </defs>
    <g transform="translate(0 4) scale(1.5)">
      <path fill="url(#cp-meta-gradient)" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </g>
    <text x="46" y="35" fontFamily={WORDMARK_FONT} fontWeight="700" fontSize="36" letterSpacing="-0.5" fill="#1c2b33">Meta</text>
  </svg>
);

// Brand names an admin can set in the `icon` column. Each carries its own full
// logo (`Logo`) and the tile background (`bg`) the brand uses in the photos.
// `ring` adds a hairline so a light/white tile still reads as a card.
const BRAND_ICONS = {
  Stripe:   { Logo: StripeLogo,          bg: '#635bff' },
  Google:   { Logo: GoogleWorkspaceLogo, bg: '#ffffff', ring: true },
  Whatnot:  { Logo: WhatnotLogo,         bg: '#ffde17' },
  Kit:      { Logo: KitLogo,             bg: '#4b9cf5' },
  Meta:     { Logo: MetaLogo,            bg: '#ffffff', ring: true },
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
        <div className="relative max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-end">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center shadow-lg shadow-brand-red/30">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/50">For sellers &amp; hobby businesses</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Building Your Business</h1>
            </div>
            <p className="text-white/70 text-lg leading-relaxed lg:pb-2">
              The tools we actually use to run CardPop — and how each one can help you grow your own card business,
              whether you sell at shows, go live, or move stock online. No single app builds a following.
              A <span className="text-white font-semibold">multi-pronged approach</span> does — each channel feeding the
              next until your presence grows on its own.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 sm:py-16 space-y-14">
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
                    <Skeleton className="h-16 w-44 rounded-2xl" />
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
                        className={`h-16 w-44 rounded-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden px-4 py-2.5 ${
                          brand ? '' : `bg-gradient-to-br ${(tool.accent || 'from-brand-red to-brand-charcoal').replace('brand-blue', 'brand-charcoal')}`
                        }`}
                        style={brand ? {
                          background: brand.bg,
                          ...(brand.ring ? { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)' } : {}),
                        } : undefined}
                      >
                        {tool.logo_url ? (
                          <img src={tool.logo_url} alt={tool.name} className="max-w-full max-h-full object-contain" loading="lazy" />
                        ) : brand ? (
                          <brand.Logo className="max-w-full max-h-full w-auto h-auto" />
                        ) : (
                          <Icon className="w-8 h-8 text-white" />
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
