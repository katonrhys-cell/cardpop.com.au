import { test, expect } from '@playwright/test';

// Regression guard for the account-menu-disappears bug.
//
// Every Radix layer (dropdown menu, select, dialog, sheet) locks scrolling
// through react-remove-scroll, which injects exactly the rule reproduced below:
// `overflow: hidden !important` on <body>. That lock is only safe while <body>'s
// overflow propagates up to the viewport — which the browser does ONLY when
// <html> has `overflow: visible` on both axes. Put anything else on <html>
// (e.g. `overflow-x: clip` as a horizontal-scrollbar safety net) and propagation
// stops: <body> itself becomes a scroll container whose scroll offset is 0, and
// every `position: sticky` descendant re-anchors to the top of the document.
// The site header then jumps off-screen the instant a menu opens on a scrolled
// page, taking the just-opened menu (anchored to its trigger) with it.

const SCROLL_LOCK_CSS = `
  body[data-scroll-locked] {
    overflow: hidden !important;
    overscroll-behavior: contain;
    position: relative !important;
  }
`;

test('<html> keeps overflow:visible so body scroll locks propagate to the viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const overflow = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { x: cs.overflowX, y: cs.overflowY };
  });
  expect(overflow).toEqual({ x: 'visible', y: 'visible' });
});

test('sticky header stays pinned when a menu locks scrolling on a scrolled page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').first()).toBeVisible();

  const SCROLL_TO = 800;

  // A tall spacer guarantees a stable scrollable extent no matter how much of
  // the page has lazily rendered — without it, a short page silently clamps the
  // scroll offset back to 0 and every assertion below passes for the wrong
  // reason. `behavior: instant` opts out of `html { scroll-behavior: smooth }`
  // so nothing races an in-flight scroll animation.
  await page.evaluate((y) => {
    const spacer = document.createElement('div');
    spacer.style.height = '3000px';
    document.body.appendChild(spacer);
    window.scrollTo({ top: y, behavior: 'instant' });
  }, SCROLL_TO);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(SCROLL_TO);

  const readState = () => page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    headerTop: document.querySelector('header').getBoundingClientRect().top,
  }));

  expect(await readState()).toEqual({ scrollY: SCROLL_TO, headerTop: 0 });

  // Apply the scroll lock exactly as a Radix layer would.
  await page.addStyleTag({ content: SCROLL_LOCK_CSS });
  await page.evaluate(() => document.body.setAttribute('data-scroll-locked', '1'));

  // Read both values together: `headerTop: 0` only proves anything while the
  // page is still scrolled away from the top. The offset is checked with a
  // floor rather than for equality because late-settling content can shorten
  // the document and clamp it by a few dozen pixels — harmless here, whereas
  // the regression moves the header by the *whole* offset (headerTop: -800).
  const locked = await readState();
  expect(locked.scrollY, 'page must still be scrolled for this assertion to mean anything').toBeGreaterThan(400);
  expect(locked.headerTop, 'header must stay pinned while a layer holds the scroll lock').toBe(0);

  // The lock must still do its job: the wheel cannot advance the page while it
  // is held.
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(locked.scrollY);
});

test('a stray wide element still cannot scroll the page horizontally', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const scrolledX = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = 'width:4000px;height:10px';
    document.body.appendChild(el);
    window.scrollTo(3000, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    el.remove();
    return x;
  });
  expect(scrolledX).toBe(0);
});
