import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { doctypeProblem, HTML5_DOCTYPE } from '../../tools/doctype.mjs';

// Google Customer Reviews requires the HTML5 DOCTYPE as the very first thing
// in the order-confirmation page — no BOM, comment or whitespace before it
// (docs/google-customer-reviews.md). That page is served from the BUILT
// app.html, so three layers guard it: the source document here, the helper
// the build plugin runs on both emitted documents, and — after `npm run
// build` — the emitted documents themselves.

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

describe('index.html (source)', () => {
  it('starts with <!DOCTYPE html> and nothing before it', () => {
    expect(doctypeProblem(read('index.html'))).toBeNull();
  });
});

describe('doctypeProblem', () => {
  it('accepts the HTML5 DOCTYPE as the first bytes', () => {
    expect(doctypeProblem(`${HTML5_DOCTYPE}\n<html lang="en"></html>`)).toBeNull();
  });

  it.each([
    ['a byte-order mark', `﻿${HTML5_DOCTYPE}`, /byte-order mark/],
    ['leading whitespace', `\n${HTML5_DOCTYPE}`, /whitespace/],
    ['a leading comment', `<!-- shell -->${HTML5_DOCTYPE}`, /comment/],
    ['a differently spelled DOCTYPE', '<!doctype html>', /spelled exactly/],
    ['a document with no DOCTYPE', '<html></html>', /does not start with/],
    ['an empty document', '', /does not start with/],
  ])('rejects %s', (_label, html, expected) => {
    expect(doctypeProblem(html)).toMatch(expected);
  });
});

// The build plugin (vite.config.js verifyDoctype) fails the build on these;
// this re-checks them locally whenever a build output is present. CI runs
// the tests before the build, so these skip there and the build step is the
// gate.
describe.each(['dist/index.html', 'dist/app.html'])('%s (built)', (rel) => {
  it.skipIf(!existsSync(path.join(root, rel)))('starts with <!DOCTYPE html> and nothing before it', () => {
    expect(doctypeProblem(read(rel))).toBeNull();
  });
});

describe('vite.config.js', () => {
  it('verifies the DOCTYPE on both emitted documents', () => {
    const config = read('vite.config.js');
    expect(config).toContain("from './tools/doctype.mjs'");
    expect(config.match(/verifyDoctype\(this, \[indexPath, appPath\]\);/g)).toHaveLength(2);
  });
});
