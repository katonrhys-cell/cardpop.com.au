import { describe, it, expect } from 'vitest';
import { needsCodeView, unsupportedVisualTags } from '@/utils/richTextSupport.js';

describe('richTextSupport', () => {
  it('lets ordinary article markup open in the visual editor', () => {
    const html = '<h2>Apps</h2><p>Use <strong>two</strong> or <em>three</em> <a href="/prices">apps</a>.</p>'
      + '<ul><li>One</li></ul><blockquote><p>Quote</p></blockquote><img src="https://x/y.webp" alt="">';
    expect(needsCodeView(html)).toBe(false);
    expect(needsCodeView('')).toBe(false);
    expect(needsCodeView(null)).toBe(false);
  });

  it('keeps content the visual editor would drop in the HTML view', () => {
    expect(needsCodeView('<p>Prices</p><table><tr><td>$5</td></tr></table>')).toBe(true);
    expect(unsupportedVisualTags('<DIV><table><tr><td>a</td><td>b</td></tr></table><iframe src="x"></iframe></DIV>'))
      .toEqual(['div', 'table', 'tr', 'td', 'iframe']);
  });
});
