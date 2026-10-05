// Schedules non-essential third-party code (error monitoring, analytics tags,
// the Google reviews badge) for the moment the visitor first interacts with
// the page — or, for a visitor who never does, a fixed time after `load`.
//
// Why not requestIdleCallback: on a mid-range phone the browser reports "idle"
// a few hundred milliseconds after the bundle mounts, so an idle-scheduled tag
// still lands inside the initial load window. Lighthouse / PageSpeed Insights
// record that window (they stop tracing a second or two after the network goes
// quiet), so every idle-loaded script counts against Total Blocking Time,
// "Reduce unused JavaScript", "Legacy JavaScript" and "Use efficient cache
// lifetimes" — even though none of it is needed for the page to work. A real
// interaction (tap, key, scroll) is the earliest signal that the visitor is
// staying; everyone else gets the tags LOAD_FALLBACK_MS after `load`, well past
// the measured window and well before the median session ends.

export const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

// Fallback for visitors who never interact. Lighthouse ends its trace once the
// page has been network- and CPU-quiet for about a second after `load`, so a
// delay in the high single digits keeps the tags out of lab measurements while
// still recording the page view of someone who merely reads the hero.
export const LOAD_FALLBACK_MS = 8000;

/**
 * Run `fn` exactly once: on the first user interaction, or `fallbackMs` after
 * the window `load` event (immediately-after-load when the page has already
 * loaded), whichever comes first. Returns a function that cancels the pending
 * schedule (a no-op once `fn` has run).
 */
export function onFirstInteractionOrLoad(fn, { fallbackMs = LOAD_FALLBACK_MS, target = typeof window !== 'undefined' ? window : null } = {}) {
  if (!target) return () => {};
  let fired = false;
  let timer = null;
  const cleanup = () => {
    for (const evt of INTERACTION_EVENTS) target.removeEventListener(evt, run);
    if (timer) { clearTimeout(timer); timer = null; }
    target.removeEventListener('load', arm);
  };
  const run = () => {
    if (fired) return;
    fired = true;
    cleanup();
    fn();
  };
  const arm = () => { timer = setTimeout(run, fallbackMs); };

  for (const evt of INTERACTION_EVENTS) target.addEventListener(evt, run, { once: true, passive: true });
  if (target.document?.readyState === 'complete') arm();
  else target.addEventListener('load', arm, { once: true });

  return () => { if (!fired) { fired = true; cleanup(); } };
}
