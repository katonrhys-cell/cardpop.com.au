import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Google prints the site name above a search result — the "CardPop Australia"
// line, not the "cardpop.com.au" one — by reading the *homepage* and picking
// from the WebSite JSON-LD name, og:site_name, <title>, headings and
// application-name. When those sources disagree it discards them all and falls
// back to the bare domain, which is exactly what happened while og:site_name
// and the Organization schema named the site two different things.
// These tests pin every source to one identical string so an edit to a single
// file can't silently drop the result back to the domain.
//
// The naming fields deliberately carry no ™ — it is display copy, and a
// decorative character is itself grounds for Google to reject a candidate. The
// ™ lives in the <title> and the social tags, which these tests allow for.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

// The bare naming string, and the trademarked form used in human-facing copy.
const SITE_NAME = 'CardPop Australia';
const DISPLAY_NAME = 'CardPop Australia™';

const html = read('index.html');

const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]));

const metaContent = (html_, selector) =>
  html_.match(new RegExp(`<meta (?:name|property)="${selector}" content="([^"]*)"`))?.[1];

describe('Google site name signals', () => {
  it('names the WebSite entity exactly, with no trademark symbol', () => {
    const website = jsonLdBlocks.find((b) => b['@type'] === 'WebSite');
    expect(website).toBeDefined();
    expect(website.name).toBe(SITE_NAME);
  });

  it('still declares the trademarked form as an alternate name', () => {
    // Dropping ™ from "name" must not drop the trademarked form from the
    // markup altogether — it stays declared, just not as the primary name.
    const website = jsonLdBlocks.find((b) => b['@type'] === 'WebSite');
    expect(website.alternateName).toContain(DISPLAY_NAME);
  });

  it('gives every homepage entity the same name', () => {
    // A differently-named Organization / OnlineStore on the same page is a
    // conflicting signal, not a harmless extra.
    const names = jsonLdBlocks
      .filter((b) => ['WebSite', 'Organization', 'OnlineStore'].includes(b['@type']))
      .map((b) => b.name);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(new Set(names)).toEqual(new Set([SITE_NAME]));
  });

  it('matches og:site_name and application-name to the schema name', () => {
    expect(metaContent(html, 'og:site_name')).toBe(SITE_NAME);
    expect(metaContent(html, 'application-name')).toBe(SITE_NAME);
  });

  it('leads the homepage title with the site name, ™ included', () => {
    // The title is a site-name candidate too, so it has to lead with the brand
    // rather than bury it after a tagline — but as display copy it keeps the ™.
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
    expect(title.startsWith(DISPLAY_NAME)).toBe(true);
  });

  it('keeps the SPA-rendered homepage title identical to the static one', () => {
    // react-helmet replaces the static <title> once the app hydrates, and
    // Googlebot indexes the rendered DOM — so this is the title it actually
    // reads.
    const staticTitle = html.match(/<title>([^<]*)<\/title>/)?.[1];
    const renderedTitle = read('pages/HomePage.jsx').match(/<SEOHead\s+title="([^"]*)"/)?.[1];
    expect(renderedTitle).toBe(staticTitle);
  });

  it('emits the same og:site_name from the SPA and the crawler prerender', () => {
    expect(read('components/SEOHead.jsx')).toContain(`const brandName = "${SITE_NAME}"`);
    expect(metaContent(read('api/prerender.js'), 'og:site_name')).toBe(SITE_NAME);
  });
});
