import React from 'react';
import { ShieldCheck, BadgeCheck, Award, Zap, User } from 'lucide-react';

/**
 * Canonical tier config — mirrors seller_tier_config in DB.
 * Used client-side so we don't need a round-trip for every badge render.
 */
export const TIER_CONFIG = {
  none: {
    label:       'New Seller',
    description: 'Account created, no sales yet',
    Icon:        User,
    badgeCls:    'bg-muted text-muted-foreground border-border',
    dotCls:      'bg-muted-foreground',
    sortOrder:   0,
  },
  verified: {
    label:       'Verified Seller',
    description: 'Identity verified by CardPop',
    Icon:        ShieldCheck,
    badgeCls:    'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/50',
    dotCls:      'bg-blue-500',
    sortOrder:   1,
  },
  trusted_seller: {
    label:       'Trusted Seller',
    description: '10+ sales · 4.5+ rating · 10+ reviews',
    Icon:        BadgeCheck,
    badgeCls:    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/50',
    dotCls:      'bg-emerald-500',
    sortOrder:   2,
  },
  top_rated_seller: {
    label:       'Top Rated Seller',
    description: '50+ sales · 4.7+ rating · 25+ reviews · Verified',
    Icon:        Award,
    badgeCls:    'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-400/50',
    dotCls:      'bg-violet-500',
    sortOrder:   3,
  },
  power_seller: {
    label:       'Power Seller',
    description: '200+ sales · 4.8+ rating · 50+ reviews · Verified',
    Icon:        Zap,
    badgeCls:    'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-400/50',
    dotCls:      'bg-amber-500',
    sortOrder:   4,
  },
  // Legacy enum values — map to nearest equivalent so nothing breaks
  powerseller: {
    label:       'Power Seller',
    description: '200+ sales · 4.8+ rating · 50+ reviews',
    Icon:        Zap,
    badgeCls:    'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-400/50',
    dotCls:      'bg-amber-500',
    sortOrder:   4,
  },
  elite: {
    label:       'Power Seller',
    description: 'Elite seller',
    Icon:        Zap,
    badgeCls:    'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-400/50',
    dotCls:      'bg-amber-500',
    sortOrder:   4,
  },
};

/**
 * SellerTierBadge
 *
 * Props:
 *   tier       — string value from seller_tier enum
 *   size       — 'xs' | 'sm' | 'md' | 'lg'
 *   showIcon   — show icon (default true)
 *   tooltip    — show description as title attr (default true)
 *   hideNone   — don't render anything for 'none' tier (default true)
 *   className  — extra classes
 */
const SellerTierBadge = ({
  tier,
  size      = 'sm',
  showIcon  = true,
  tooltip   = true,
  hideNone  = true,
  className = '',
}) => {
  const cfg = TIER_CONFIG[tier];

  if (!cfg || (hideNone && (tier === 'none' || !tier))) return null;

  const { label, description, Icon, badgeCls } = cfg;

  const sizes = {
    xs: { wrap: 'px-1.5 py-0.5 text-[10px] gap-0.5 rounded-md',  icon: 'w-2.5 h-2.5' },
    sm: { wrap: 'px-2 py-0.5 text-[11px] gap-1 rounded-md',      icon: 'w-3 h-3' },
    md: { wrap: 'px-2.5 py-1 text-xs gap-1.5 rounded-lg',        icon: 'w-3.5 h-3.5' },
    lg: { wrap: 'px-3 py-1.5 text-sm gap-2 rounded-xl',          icon: 'w-4 h-4' },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <span
      className={`inline-flex items-center font-bold border ${badgeCls} ${s.wrap} ${className}`}
      title={tooltip ? description : undefined}
    >
      {showIcon && <Icon className={`${s.icon} shrink-0`} />}
      {label}
    </span>
  );
};

export default SellerTierBadge;
