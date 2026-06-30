import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, BadgeCheck, Award, Zap, User, TrendingUp, Star, Package, Lock } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { isVerified } from '@/utils/verification.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import SellerTierBadge, { TIER_CONFIG } from '@/components/SellerTierBadge.jsx';

const TIERS = [
  {
    key:         'verified',
    label:       'Verified Seller',
    Icon:        ShieldCheck,
    color:       'blue',
    req:         { sales: 0,   rating: 0,    reviews: 0,  verified: true },
    perks:       ['Verified badge on your profile', 'Badge shown on all listings', 'Increased buyer confidence', 'Access to premium features'],
  },
  {
    key:         'trusted_seller',
    label:       'Trusted Seller',
    Icon:        BadgeCheck,
    color:       'emerald',
    req:         { sales: 10,  rating: 4.5,  reviews: 10, verified: false },
    perks:       ['Trusted Seller badge', 'Priority placement in search', 'Reduced dispute rate threshold', 'Trusted Seller certificate'],
  },
  {
    key:         'top_rated_seller',
    label:       'Top Rated Seller',
    Icon:        Award,
    color:       'violet',
    req:         { sales: 50,  rating: 4.7,  reviews: 25, verified: true },
    perks:       ['Top Rated badge on all listings', 'Featured in Top Rated section', 'Reduced final value fee', 'Priority customer support'],
  },
  {
    key:         'power_seller',
    label:       'Power Seller',
    Icon:        Zap,
    color:       'amber',
    req:         { sales: 200, rating: 4.8,  reviews: 50, verified: true },
    perks:       ['Power Seller badge', 'Lowest platform fees', 'Dedicated account manager', 'Early access to new features', 'Featured on homepage'],
  },
];

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-400/50',    text: 'text-blue-700 dark:text-blue-400',    bar: 'bg-blue-500',    ring: 'ring-blue-400/30' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-400/50', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'ring-emerald-400/30' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-400/50',  text: 'text-violet-700 dark:text-violet-400',  bar: 'bg-violet-500',  ring: 'ring-violet-400/30' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-400/50',   text: 'text-amber-800 dark:text-amber-400',    bar: 'bg-amber-500',   ring: 'ring-amber-400/30' },
};

const ProgressBar = ({ value, max, colorCls }) => {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${colorCls}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const Req = ({ met, label, current, target, colorBar }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className={`font-medium ${met ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-bold tabular-nums ${met ? 'text-emerald-600' : 'text-muted-foreground'}`}>
        {current} / {target} {met ? '✓' : ''}
      </span>
    </div>
    <ProgressBar value={current} max={target} colorCls={met ? 'bg-emerald-500' : colorBar} />
  </div>
);

const AccountSellerTier = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    supabase.from('profiles')
      .select('seller_tier, total_sales, rating, reviews_count, is_verified, verification_status')
      .eq('id', currentUser.id)
      .single()
      .then(({ data }) => { if (!cancelled) { setProfile(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid md:grid-cols-2 gap-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
    </div>
  );

  const sales      = profile?.total_sales    ?? 0;
  const rating     = parseFloat(profile?.rating ?? 0);
  const reviews    = profile?.reviews_count  ?? 0;
  const verified   = isVerified(profile?.is_verified);
  const currentTier = profile?.seller_tier   ?? 'none';

  const currentTierIdx = TIERS.findIndex(t => t.key === currentTier);
  const nextTier = currentTierIdx < TIERS.length - 1 ? TIERS[currentTierIdx + 1] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <Helmet><title>Seller Tier | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Seller Tier' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-1">Seller Tier</h1>
        <p className="text-muted-foreground">Your reputation level and path to the next tier.</p>
      </div>

      {/* Current status */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {currentTier !== 'none' ? (
            (() => {
              const cfg = TIER_CONFIG[currentTier];
              const Icon = cfg?.Icon;
              return Icon ? <Icon className="w-10 h-10 text-primary" /> : <User className="w-10 h-10 text-primary" />;
            })()
          ) : (
            <User className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="text-center sm:text-left">
          <p className="text-sm text-muted-foreground font-medium mb-1">Current Tier</p>
          {currentTier !== 'none' ? (
            <SellerTierBadge tier={currentTier} size="lg" />
          ) : (
            <span className="text-xl font-bold text-foreground">New Seller</span>
          )}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground justify-center sm:justify-start">
            <span className="flex items-center gap-1.5"><Package className="w-4 h-4" />{sales} sales</span>
            <span className="flex items-center gap-1.5"><Star className="w-4 h-4 fill-amber-400 text-amber-400" />{rating > 0 ? rating.toFixed(1) : 'No rating'}</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4" />{reviews} reviews</span>
          </div>
        </div>
        {nextTier && (
          <div className="sm:ml-auto text-center sm:text-right">
            <p className="text-xs text-muted-foreground mb-1">Next tier</p>
            <SellerTierBadge tier={nextTier.key} size="md" />
          </div>
        )}
      </div>

      {/* Tier roadmap */}
      <div className="grid md:grid-cols-2 gap-4">
        {TIERS.map((tier, idx) => {
          const col   = COLOR_MAP[tier.color];
          const req   = tier.req;
          const metSales    = sales   >= req.sales;
          const metRating   = rating  >= req.rating  || req.rating === 0;
          const metReviews  = reviews >= req.reviews;
          const metVerified = !req.verified || verified;
          const allMet = metSales && metRating && metReviews && metVerified;
          const isCurrent = tier.key === currentTier;
          const isAchieved = TIERS.findIndex(t => t.key === currentTier) > idx || isCurrent;
          const Icon = tier.Icon;

          return (
            <div
              key={tier.key}
              className={`bg-card border rounded-2xl p-6 space-y-5 transition-all ${isCurrent ? `${col.border} ring-4 ${col.ring}` : isAchieved ? 'border-emerald-400/30' : 'border-border'}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${col.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${col.text}`} />
                  </div>
                  <div>
                    <p className={`font-bold ${col.text}`}>{tier.label}</p>
                    {isAchieved && !isCurrent && <p className="text-xs text-emerald-600 font-bold">✓ Achieved</p>}
                    {isCurrent && <p className="text-xs text-muted-foreground font-medium">Current tier</p>}
                  </div>
                </div>
                {isAchieved && <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><span className="text-white text-xs font-bold">✓</span></div>}
                {!isAchieved && !allMet && <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
              </div>

              {/* Requirements progress */}
              <div className="space-y-3">
                {req.sales > 0 && (
                  <Req met={metSales} label="Completed Sales" current={Math.min(sales, req.sales)} target={req.sales} colorBar={col.bar} />
                )}
                {req.rating > 0 && (
                  <Req met={metRating} label={`Rating (${req.rating}+ required)`} current={Math.min(rating, req.rating)} target={req.rating} colorBar={col.bar} />
                )}
                {req.reviews > 0 && (
                  <Req met={metReviews} label="Reviews" current={Math.min(reviews, req.reviews)} target={req.reviews} colorBar={col.bar} />
                )}
                {req.verified && (
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${metVerified ? 'text-foreground' : 'text-muted-foreground'}`}>Identity Verified</span>
                    <span className={`font-bold ${metVerified ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {metVerified ? 'Verified ✓' : 'Required'}
                    </span>
                  </div>
                )}
              </div>

              {/* Perks */}
              <div className="pt-3 border-t border-border space-y-1.5">
                {tier.perks.map(perk => (
                  <div key={perk} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAchieved ? 'bg-emerald-500' : col.bar}`} />
                    <span className={isAchieved ? 'text-foreground' : 'text-muted-foreground'}>{perk}</span>
                  </div>
                ))}
              </div>

              {/* CTA if not yet verified */}
              {req.verified && !metVerified && !isCurrent && (
                <Button asChild variant="outline" size="sm" className="w-full rounded-xl text-xs font-bold gap-1.5 border-blue-400/50 text-blue-600">
                  <Link to="/account/verification"><ShieldCheck className="w-3.5 h-3.5" /> Verify Identity</Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ note */}
      <div className="bg-muted/40 border border-border rounded-2xl p-5 text-sm text-muted-foreground">
        <p className="font-bold text-foreground mb-1">How are tiers calculated?</p>
        <p>Tiers update automatically as you complete sales and receive reviews. Completed sales are counted when an order reaches <span className="font-bold">completed</span> status. Ratings are the average across all visible reviews. Identity verification is managed under <Link to="/account/verification" className="text-primary font-bold hover:underline">Account Verification</Link>.</p>
      </div>
    </div>
  );
};

export default AccountSellerTier;
