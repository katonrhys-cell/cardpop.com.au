import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Google Customer Reviews requires the HTML5 DOCTYPE as the very first thing
// in the page — no BOM, comment or whitespace before it (docs/google-customer-reviews.md).
describe('index.html', () => {
  it('starts with <!DOCTYPE html> and nothing before it', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});
