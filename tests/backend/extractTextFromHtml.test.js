import { describe, it, expect } from 'vitest';
import { extractTextFromHtml } from '../../src/utils/safeFetch.js';

// Site audit 2026-11-19: the script/style regexes were quadratic on unclosed
// tags (2 MB of `<script>` took about two minutes, synchronously), so one
// hostile page could stall the event scanner past its function limit.
describe('extractTextFromHtml', () => {
  it('drops script and style blocks, case-insensitively, and keeps look-alike tags', () => {
    expect(extractTextFromHtml('<p>Hi</p><SCRIPT a=1>x()</script>there<style>.a{}</style><scripts>keep</scripts>'))
      .toBe('Hi there keep');
  });

  it('treats an unclosed block as running to the end of the document', () => {
    expect(extractTextFromHtml('<p>Before</p><script>never closed <p>hidden</p>')).toBe('Before');
  });

  it('is linear on hostile input', () => {
    const started = Date.now();
    extractTextFromHtml('<script>'.repeat(260000)); // ~2 MB, the fetch body cap
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
