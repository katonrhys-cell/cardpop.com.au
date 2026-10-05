import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onFirstInteractionOrLoad, LOAD_FALLBACK_MS, INTERACTION_EVENTS } from '@/lib/deferredLoad.js';

// Third-party code (Sentry, gtag, the Google reviews badge) must stay out of
// the initial load window Lighthouse measures, yet still load for a visitor
// who never touches the page. These pin the two triggers and the once-only
// guarantee the loaders rely on.

const setReadyState = (value) => {
  Object.defineProperty(document, 'readyState', { value, configurable: true });
};

describe('onFirstInteractionOrLoad', () => {
  beforeEach(() => { vi.useFakeTimers(); setReadyState('loading'); });
  afterEach(() => { vi.useRealTimers(); setReadyState('complete'); });

  it('runs once on the first interaction and never again', () => {
    const fn = vi.fn();
    onFirstInteractionOrLoad(fn);
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('pointerdown'));
    expect(fn).toHaveBeenCalledTimes(1);
    // A later load + fallback must not fire it a second time.
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(LOAD_FALLBACK_MS + 1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('falls back to LOAD_FALLBACK_MS after load for a visitor who never interacts', () => {
    const fn = vi.fn();
    onFirstInteractionOrLoad(fn);
    vi.advanceTimersByTime(LOAD_FALLBACK_MS * 2);
    expect(fn).not.toHaveBeenCalled(); // not loaded yet — timer isn't armed
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(LOAD_FALLBACK_MS - 1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('arms the fallback immediately when the page has already loaded', () => {
    setReadyState('complete');
    const fn = vi.fn();
    onFirstInteractionOrLoad(fn, { fallbackMs: 500 });
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled before it fires', () => {
    setReadyState('complete');
    const fn = vi.fn();
    const cancel = onFirstInteractionOrLoad(fn, { fallbackMs: 500 });
    cancel();
    for (const evt of INTERACTION_EVENTS) window.dispatchEvent(new Event(evt));
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps the fallback well past the window Lighthouse records', () => {
    // Lighthouse stops tracing ~1–3 s after load once the page is quiet; the
    // old 4 s fallback (and idle callbacks) landed inside it.
    expect(LOAD_FALLBACK_MS).toBeGreaterThanOrEqual(6000);
  });
});
