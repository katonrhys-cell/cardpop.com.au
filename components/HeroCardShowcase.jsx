import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import HeroCardImage from '@/components/HeroCardImage.jsx';
import { getCardImage, markTransformsUnavailable } from '@/utils/imageUrl.js';

// The built-in HERO_CARDS reference extension-less stems
// ("/images/hero/black-lotus") that resolve to responsive AVIF/WebP/JPG
// variants, whereas DB-driven showcase rows store a full image URL with its
// extension. Render each kind appropriately so the photos actually load.
const hasFileExtension = (src) => /\.(avif|webp|jpe?g|png|gif)$/i.test(src || '');

// DB-driven showcase art. Rows store the full-resolution Supabase object URL
// (multi-megabyte card scans) — route it through getCardImage so the browser
// fetches a right-sized, CDN-routed transform instead of the original, with
// the same tiered fallback CardImage uses (transformed → untransformed CDN →
// Supabase origin) so a missing transform feature or CDN outage self-heals.
const REMOTE_ART_WIDTHS = [160, 320, 480];

const RemoteCardArt = ({ image, padding, sizes }) => {
  const [tier, setTier] = useState(0);
  const art = useMemo(() => getCardImage(image, { widths: REMOTE_ART_WIDTHS, quality: 70 }), [image]);

  const candidates = useMemo(() => {
    const list = [];
    if (art.thumbSrc) list.push({ url: art.thumbSrc, kind: 'thumb' });
    if (art.src) list.push({ url: art.src, srcSet: art.srcSet || undefined, kind: 'primary' });
    if (art.fallbackSrc && art.fallbackSrc !== art.src) list.push({ url: art.fallbackSrc });
    if (art.canonicalSrc && art.canonicalSrc !== art.src && art.canonicalSrc !== art.fallbackSrc) {
      list.push({ url: art.canonicalSrc });
    }
    return list;
  }, [art]);

  const active = candidates[Math.min(tier, candidates.length - 1)];
  if (!active) return null;

  return (
    <img
      src={active.url}
      srcSet={active.srcSet}
      sizes={active.srcSet ? sizes : undefined}
      alt=""
      className={`absolute inset-0 w-full h-full object-contain ${padding}`}
      draggable={false}
      loading="lazy"
      decoding="async"
      // Runs its own tiered fallback — opt out of the global CDN→origin net
      // in utils/imageCdnFallback.js so the two don't fight over src.
      data-managed-image=""
      onError={() => {
        if (active?.kind === 'primary') markTransformsUnavailable();
        if (tier < candidates.length - 1) setTier(tier + 1);
      }}
    />
  );
};

const CardArt = ({ image, padding = 'p-1', sizes = '160px' }) => {
  if (!image) return null;
  if (hasFileExtension(image)) {
    return <RemoteCardArt image={image} padding={padding} sizes={sizes} />;
  }
  return <HeroCardImage stem={image} alt="" />;
};

/**
 * HeroCardShowcase
 * ----------------
 * Animated hero centrepiece that plays the 6-stage "card show" sequence:
 *
 *   1. Shelf Display    — cards rest on the cabinet shelf in the background
 *   2. Card Selected    — one card brightens and lifts off the shelf
 *   3. Moving Forward   — the card travels down toward the foreground, growing
 *   4. Landing on Stand — the card drops onto the display stand (slight bounce)
 *   5. Settle & Focus   — the card settles as a spotlight rises behind it
 *   6. Hero State       — the card holds, fully lit, then fades and the next
 *                         card takes its turn
 *
 * Re-uses the existing HERO_CARDS imagery from the homepage. Purely decorative,
 * so it is hidden from assistive tech and collapses to a single static card
 * when the user prefers reduced motion.
 */

// One full cycle (travel + hold + handoff) in milliseconds.
const CYCLE_MS = 6500;

// Shelf card footprint (width + gap) used to work out where each card sits on
// the shelf so the flying card can originate from its exact slot.
const SHELF_SLOT = 80; // 68px card + 12px gap
const SHELF_Y = -150;

const HeroCardShowcase = ({ cards = [] }) => {
  const prefersReduced = useReducedMotion();
  const [active, setActive] = useState(0);

  const count = cards.length;

  // Advance the "selected" card on each cycle.
  useEffect(() => {
    if (prefersReduced || count <= 1) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % count);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [prefersReduced, count]);

  if (count === 0) return null;

  const activeCard = cards[active];
  // X-offset (from stage centre) of the active card's shelf slot, so the flying
  // card lifts out of the right spot regardless of how many cards are on show.
  const sx = (active - (count - 1) / 2) * SHELF_SLOT;

  // Keyframe timeline for the flying card. Shared `times` keeps every track
  // in lock-step across the 6 stages.
  //                stage:  shelf  select  forward  land   settle  hold   exit
  const times = [0, 0.08, 0.42, 0.54, 0.62, 0.92, 1];
  const flyKeyframes = {
    x:       [sx, sx, 0, 0, 0, 0, 0],
    y:       [SHELF_Y, SHELF_Y - 24, -28, 86, 66, 66, 60],
    scale:   [0.42, 0.48, 0.8, 1.05, 1, 1, 0.98],
    opacity: [0, 1, 1, 1, 1, 1, 0],
    rotateZ: [-3, -2, 2, -1, 0, 0, 0],
  };

  return (
    <div
      aria-hidden="true"
      className="absolute right-[1%] xl:right-[4%] top-1/2 -translate-y-1/2 hidden lg:block w-[540px] h-[460px] pointer-events-none select-none"
    >
      {/* ── Background cabinet / shelf ── */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[460px]">
        {/* Cards resting on the shelf */}
        <div className="relative flex items-end justify-center gap-3 px-4">
          {cards.map((card, i) => {
            const isOut = !prefersReduced && i === active;
            return (
              <div key={i} className="relative w-[68px] h-[94px] flex-shrink-0">
                {/* Empty-slot glow shown while this card is "in flight" */}
                {isOut && (
                  <div
                    className="absolute inset-0 rounded-md border border-yellow-400/30"
                    style={{ animation: 'hero-shelf-shimmer 2s ease-in-out infinite' }}
                  />
                )}
                <div
                  className={`absolute inset-0 rounded-md overflow-hidden bg-gradient-to-br ${card.gradient} border ${card.borderColor} transition-opacity duration-500`}
                  style={{
                    opacity: isOut ? 0.12 : 0.9,
                    boxShadow: '0 8px 16px -6px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.05)',
                  }}
                >
                  <CardArt image={card.image} padding="p-0.5" sizes="68px" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Shelf ledge */}
        <div
          className="mx-auto mt-1 h-3 w-[440px] rounded-sm"
          style={{
            background: 'linear-gradient(180deg, rgba(120,90,50,0.55) 0%, rgba(40,28,16,0.9) 100%)',
            boxShadow: '0 10px 22px -8px rgba(0,0,0,0.9)',
          }}
        />
        <div className="mx-auto h-px w-[440px] bg-white/10" />
      </div>

      {/* ── Spotlight beam onto the stand (rises as the card settles) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`beam-${active}`}
          className="absolute left-1/2 -translate-x-1/2 bottom-[40px] w-72 h-72 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 50% 60% at 50% 35%, rgba(255,235,170,0.30) 0%, rgba(255,220,120,0.10) 45%, transparent 72%)',
            filter: 'blur(6px)',
          }}
          initial={{ opacity: 0 }}
          animate={
            prefersReduced
              ? { opacity: 0.9 }
              : { opacity: [0, 0, 0.2, 0.55, 0.95, 0.95, 0] }
          }
          transition={prefersReduced ? { duration: 0.6 } : { duration: CYCLE_MS / 1000, times, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* ── The flying / featured card ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`fly-${active}`}
          className={`absolute w-40 h-56 rounded-2xl overflow-hidden bg-gradient-to-br ${activeCard.gradient} border ${activeCard.borderColor}`}
          style={{
            left: '50%',
            top: '50%',
            marginLeft: -80,
            marginTop: -112,
            boxShadow:
              '0 40px 80px -16px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.07), 0 0 60px -10px rgba(255,210,90,0.35)',
          }}
          initial={
            prefersReduced
              ? { opacity: 1, x: 0, y: 60, scale: 1, rotateZ: 0 }
              : { opacity: 0, x: sx, y: SHELF_Y, scale: 0.42, rotateZ: -3 }
          }
          animate={
            prefersReduced
              ? { opacity: 1, x: 0, y: 60, scale: 1, rotateZ: 0 }
              : flyKeyframes
          }
          transition={
            prefersReduced
              ? { duration: 0.6 }
              : { duration: CYCLE_MS / 1000, times, ease: [0.22, 0.61, 0.36, 1] }
          }
        >
          {/* Card art */}
          <CardArt image={activeCard.image} padding="p-1" sizes="160px" />

          {/* Holographic shimmer */}
          <div
            className="absolute inset-0 z-20 pointer-events-none mix-blend-screen"
            style={{
              background:
                'linear-gradient(125deg, transparent 15%, rgba(255,80,180,0.40) 30%, rgba(80,220,255,0.40) 50%, rgba(255,240,80,0.30) 70%, transparent 85%)',
              backgroundSize: '300% 300%',
              animation: 'holo 3.4s ease-in-out infinite',
            }}
          />

          {/* Edge gloss */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/40 pointer-events-none z-30" />

          {/* Price / rarity badge */}
          <div className="absolute bottom-0 left-0 right-0 z-40 px-2.5 pb-2.5 pt-5 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
            <div className="text-[8px] font-bold text-white/55 uppercase tracking-widest mb-0.5">
              {activeCard.rarity}
            </div>
            <div className="text-[10px] font-black text-yellow-300 drop-shadow">{activeCard.value}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Display stand in the foreground ── */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[34px] w-40 pointer-events-none">
        {/* Acrylic back-lip the card leans against */}
        <div
          className="mx-auto h-10 w-24 rounded-t-md"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderBottom: 'none',
          }}
        />
        {/* Base plate */}
        <div
          className="mx-auto -mt-1 h-2.5 w-32 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(200,200,210,0.18) 0%, rgba(20,20,26,0.9) 100%)',
            boxShadow: '0 12px 24px -8px rgba(0,0,0,0.9)',
          }}
        />
      </div>

      {/* ── Reflection / stage glow beneath the stand ── */}
      <div
        className="absolute bottom-[20px] left-1/2 -translate-x-1/2 w-72 h-16 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,205,90,0.20) 0%, transparent 75%)',
          animation: 'hero-stand-glow 4s ease-in-out infinite',
        }}
      />
    </div>
  );
};

export default HeroCardShowcase;
