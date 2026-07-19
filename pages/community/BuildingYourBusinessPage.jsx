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
// inlined as SVGs (same approach as components/OAuthButtons.jsx). Stripe's mark is
// a single colour and rides on the card's gradient tile like the lucide icons;
// Google's is multi-colour and needs a light tile, so it's flagged `light`.
const StripeMark = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="#fff" className={className} aria-hidden="true">
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

// Brand names an admin can set in the `icon` column. `light` marks need a light
// tile instead of the coloured gradient (Google's multi-colour G).
const BRAND_ICONS = {
  Stripe: { Icon: StripeMark, light: false },
  Google: { Icon: GoogleMark, light: true },
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
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
                        brand?.light
                          ? 'bg-white ring-1 ring-black/5'
                          : `bg-gradient-to-br ${tool.accent || 'from-brand-red to-brand-blue'}`
                      }`}>
                        {tool.logo_url ? (
                          <img src={tool.logo_url} alt={tool.name} className="w-full h-full object-contain p-2" loading="lazy" />
                        ) : brand ? (
                          <brand.Icon className="w-7 h-7" />
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
