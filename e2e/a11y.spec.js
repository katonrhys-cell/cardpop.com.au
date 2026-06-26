import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real-browser accessibility audit. Unlike the happy-dom axe unit tests
// (tests/frontend/a11y.test.jsx), this runs against the actual rendered build
// in Chromium, so it can evaluate the checks that need real layout + computed
// styles — most importantly **colour contrast** against the live brand palette.
//
// Scope: WCAG 2.0/2.1/2.2 A and AA — the AU DDA / WCAG 2.2 AA target. We fail
// on `serious` and `critical` impact (the issues that actually block users);
// `minor`/`moderate` findings are surfaced in the attached report for the
// manual audit but don't break the build, so this can be adopted without a
// big-bang remediation.

const PAGES = ['/', '/marketplace', '/shop', '/login'];

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

for (const path of PAGES) {
  test(`a11y: ${path} has no serious/critical WCAG AA violations`, async ({ page }, testInfo) => {
    // Reduce motion + let entrance animations finish, otherwise axe can sample a
    // mid-fade element (opacity < 1) and report a transient contrast "failure"
    // for text that is settled and compliant once the animation completes.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    // Let lazy route chunks + first paint settle.
    await page.locator('#root').waitFor({ state: 'attached' });
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForLoadState('networkidle').catch(() => {});
    // Final settle for framer-motion entrance transitions (~0.3s each).
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();

    // Always attach the full report for triage.
    await testInfo.attach(`axe-${path.replace(/\//g, '_') || 'home'}.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });

    const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact));
    const summary = blocking
      .map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.helpUrl}`)
      .join('\n');

    expect(blocking, `Serious/critical a11y violations on ${path}:\n${summary}`).toEqual([]);
  });
}
