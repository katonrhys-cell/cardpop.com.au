import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * VerifiedBadge - shows the CardPop identity-verified badge.
 * size: 'sm' | 'md' | 'lg'
 * showLabel: whether to render the text beside the icon
 */
const VerifiedBadge = ({ size = 'sm', showLabel = false, className = '' }) => {
  const sizes = {
    sm: { icon: 'w-3.5 h-3.5', text: 'text-[10px]', gap: 'gap-0.5' },
    md: { icon: 'w-4 h-4',     text: 'text-xs',     gap: 'gap-1' },
    lg: { icon: 'w-5 h-5',     text: 'text-sm',     gap: 'gap-1.5' },
  };
  const s = sizes[size] || sizes.sm;

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${className}`}
      style={{ color: `hsl(var(--verified-badge))` }}
      title="Identity Verified by CardPop"
    >
      <CheckCircle2 className={`${s.icon} shrink-0`} />
      {showLabel && <span className={`${s.text} font-bold`}>Verified</span>}
    </span>
  );
};

export default VerifiedBadge;
