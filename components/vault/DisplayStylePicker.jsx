import React from 'react';
import { Lock, Square, Frame, Wind, Gem, Layers, RefreshCw, Sparkles, Crown, Zap, Flashlight, Triangle, Orbit } from 'lucide-react';
import { toast } from 'sonner';
import CardShowcase from '@/components/vault/CardShowcase.jsx';
import {
  DISPLAY_STYLES,
  TIER_META,
  normalizeTier,
  normalizeStyle,
  canUseStyle,
  getStyleByKey,
} from '@/lib/displayStyles.js';

// Icons live on the component side so the registry stays framework-agnostic.
const STYLE_ICON = {
  classic:     Square,
  stand:       Frame,
  floating:    Wind,
  neon:        Zap,
  glass:       Gem,
  slab:        Layers,
  spotlight:   Flashlight,
  rotating:    RefreshCw,
  spinning:    Orbit,
  prism:       Triangle,
  holographic: Sparkles,
};

// Tier pill styling for locked styles, drawn from the existing tier palette.
const TIER_PILL = {
  pro:      'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/40',
  premium:  'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-400/40',
  elite:    'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-400/40',
  ultimate: 'bg-primary/10 text-primary border-primary/40',
};

/**
 * DisplayStylePicker — choose how a vault listing is presented.
 *
 * Shows every style with a live preview rendered through the real Card Showcase
 * Engine (using the listing's own photo when available). Styles above the
 * user's subscription tier are shown locked with the tier needed to unlock
 * them, so the upgrade path is visible without blocking the listing flow.
 *
 * Props:
 *   value       — selected style key
 *   onChange    — (styleKey) => void
 *   userTier    — the lister's subscription_tier
 *   previewSrc  — image URL to preview inside each style (the card's photo)
 *   previewSrcSet / previewSizes / previewFallback — optional responsive image
 */
const DisplayStylePicker = ({
  value,
  onChange,
  userTier,
  previewSrc,
  previewSrcSet,
  previewSizes,
  previewFallback,
  className = '',
}) => {
  const tier = normalizeTier(userTier);
  const selected = normalizeStyle(value);

  const handleLocked = (style) => {
    const need = TIER_META[style.minTier]?.label || style.minTier;
    toast.info(`${style.label} is a ${need} display style`, {
      description: `Upgrade to ${need} to showcase your cards in this style.`,
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label="Display style"
      className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${className}`}
    >
      {DISPLAY_STYLES.map((style) => {
        const Icon = STYLE_ICON[style.key] || Square;
        const unlocked = canUseStyle(style.key, tier);
        const isSelected = selected === style.key && unlocked;
        const tierLabel = TIER_META[style.minTier]?.label || style.minTier;

        return (
          <button
            key={style.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${style.label}${unlocked ? '' : ` (requires ${tierLabel})`}`}
            onClick={() => (unlocked ? onChange?.(style.key) : handleLocked(style))}
            className={`group/style relative flex flex-col rounded-xl border-2 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden ${
              isSelected
                ? 'border-primary shadow-sm'
                : 'border-border bg-background hover:border-muted-foreground/40'
            } ${unlocked ? '' : 'cursor-not-allowed'}`}
          >
            {/* Live preview in the real style */}
            <div className="relative aspect-[4/5] bg-muted/30 overflow-hidden">
              <CardShowcase
                src={previewSrc}
                srcSet={previewSrcSet}
                sizes={previewSizes}
                fallbackSrc={previewFallback}
                alt={`${style.label} preview`}
                displayStyle={style.key}
                loading="lazy"
              />
              {/* Locked overlay */}
              {!unlocked && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[2px]">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${TIER_PILL[style.minTier] || ''}`}>
                    {style.minTier === 'ultimate' && <Crown className="w-3 h-3" />}
                    {tierLabel}
                  </span>
                </div>
              )}
              {/* Selected check */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                  <span className="text-xs font-bold">✓</span>
                </div>
              )}
            </div>

            {/* Label */}
            <div className="p-2.5">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`font-bold text-xs leading-tight truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {style.label}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                {style.tagline}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default DisplayStylePicker;

// Re-export for callers that want the human label of the current selection.
export const getDisplayStyleLabel = (key) => getStyleByKey(normalizeStyle(key))?.label;
