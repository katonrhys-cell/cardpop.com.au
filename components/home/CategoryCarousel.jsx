import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** How often the strip drifts forward one tile on its own, and how long a visitor's touch holds it still. */
export const CATEGORY_AUTOPLAY_MS = 3500;
export const CATEGORY_AUTOPLAY_PAUSE_MS = 8000;
/** Tiles the desktop arrows move at once (there are 8 in view). */
const ARROW_TILES = 4;

const reducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const whenIdle = (fn) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(fn, { timeout: 1500 })
    : window.setTimeout(fn, 200);
const cancelIdle = (id) =>
  typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : window.clearTimeout(id);

const Tile = ({ cat, hidden }) => (
  <div className="snap-start shrink-0 w-[88px] mr-3 sm:mr-0 sm:w-[12.5%] sm:px-2" aria-hidden={hidden || undefined}>
    <Link
      to={cat.slug ? `/collections/${cat.slug}` : '/marketplace'}
      tabIndex={hidden ? -1 : undefined}
      className={`group flex flex-col items-center justify-center gap-1.5 sm:gap-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br ${cat.gradient} aspect-square shadow-sm hover:shadow-lg hover:-translate-y-0.5 sm:hover:-translate-y-1 transition-all duration-200 text-center leading-tight`}
    >
      <cat.Icon className="w-5 h-5 sm:w-9 sm:h-9 drop-shadow-sm" />
      <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-white drop-shadow-sm px-1 sm:px-0">{cat.name}</span>
    </Link>
  </div>
);

/**
 * Homepage "Browse by Category": one endless strip. It is a native scroll-snap
 * track, so it swipes on a phone and scrolls on a trackpad, and it never runs
 * out — the list is rendered three times and, whenever the visitor drifts into
 * the first or last copy, the scroll position is silently moved by exactly one
 * copy so they are looking at identical tiles in the middle again.
 *
 * It also rotates on its own — one tile every few seconds — so nobody has to
 * touch anything to see the rest. That pauses while the strip is hovered,
 * focused, touched or scrolled by the visitor, when it is off screen or the tab
 * is hidden, and never runs under `prefers-reduced-motion`. The arrows
 * (from `sm` up) are an extra, not a requirement.
 *
 * The two extra copies are added after first paint (idle), so the first render
 * only builds one set of tiles; the copies are `aria-hidden` and out of the tab
 * order, so assistive tech and keyboards see each category once.
 */
const CategoryCarousel = ({ categories }) => {
  const trackRef = useRef(null);
  const [looped, setLooped] = useState(false);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const onScreen = useRef(true);
  const settleTimer = useRef(null);
  const total = categories.length;

  // Build the clones once the browser is idle.
  useEffect(() => {
    const id = whenIdle(() => setLooped(true));
    return () => cancelIdle(id);
  }, []);

  /** Pixel width of one full copy of the list (measured: tiles can be fractional). */
  const copyWidth = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.children[total] || !el.children[0]) return 0;
    return el.children[total].offsetLeft - el.children[0].offsetLeft;
  }, [total]);

  /** Distance between one tile and the next. */
  const pitch = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.children[1] || !el.children[0]) return 0;
    return el.children[1].offsetLeft - el.children[0].offsetLeft;
  }, []);

  // Land on the middle copy as soon as the clones exist, before they paint.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!looped || !el) return;
    const w = copyWidth();
    if (w > 0) el.scrollLeft += w;
  }, [looped, copyWidth]);

  /** Move by whole copies so the visitor stays in the middle one. `urgent` = near a hard edge. */
  const recentre = useCallback((urgent) => {
    const el = trackRef.current;
    if (!looped || !el) return;
    const w = copyWidth();
    if (w <= 0) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const nearEdge = scrollLeft < clientWidth || scrollLeft > scrollWidth - 2 * clientWidth;
    if (urgent && !nearEdge) return;
    if (scrollLeft < w * 0.5) el.scrollLeft = scrollLeft + w;
    else if (scrollLeft > w * 1.5) el.scrollLeft = scrollLeft - w;
  }, [looped, copyWidth]);

  const onScroll = () => {
    recentre(true);
    // Once the scroll settles, tidy up properly (not mid-fling, which would cut momentum).
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => recentre(false), 150);
  };
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const holdStill = () => { pausedUntil.current = Date.now() + CATEGORY_AUTOPLAY_PAUSE_MS; };

  // Only drift while the strip is actually on screen.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => { onScreen.current = entry.isIntersecting; });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollByTiles = useCallback((tiles) => {
    const el = trackRef.current;
    if (!el) return;
    const step = pitch() * tiles;
    if (!step) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: el.scrollLeft + step, behavior: 'smooth' });
    else el.scrollLeft += step;
  }, [pitch]);

  // Auto-rotate.
  useEffect(() => {
    if (!looped || reducedMotion()) return undefined;
    const id = window.setInterval(() => {
      if (document.hidden || hovering.current || !onScreen.current || Date.now() < pausedUntil.current) return;
      scrollByTiles(1);
    }, CATEGORY_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [looped, scrollByTiles]);

  const arrowClass =
    'hidden sm:flex flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border shadow-sm items-center justify-center hover:bg-muted transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => { holdStill(); scrollByTiles(-ARROW_TILES); }}
        aria-label="Previous categories"
        className={arrowClass}
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>

      <div
        ref={trackRef}
        data-testid="category-carousel-track"
        aria-label="Categories"
        onScroll={onScroll}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') hovering.current = true; }}
        onPointerLeave={() => { hovering.current = false; }}
        onTouchStart={holdStill}
        onWheel={holdStill}
        onFocus={holdStill}
        className="flex-1 min-w-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide py-2 -my-2 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-px-4 sm:scroll-px-0"
      >
        {looped && categories.map((cat, i) => <Tile key={`before-${i}`} cat={cat} hidden />)}
        {categories.map((cat, i) => <Tile key={`main-${i}`} cat={cat} />)}
        {looped && categories.map((cat, i) => <Tile key={`after-${i}`} cat={cat} hidden />)}
      </div>

      <button
        type="button"
        onClick={() => { holdStill(); scrollByTiles(ARROW_TILES); }}
        aria-label="Next categories"
        className={arrowClass}
      >
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default CategoryCarousel;
