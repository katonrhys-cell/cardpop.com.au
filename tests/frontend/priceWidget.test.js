import { describe, it, expect } from 'vitest';
import {
  priceWidgetSnippet, priceWidgetSvg, priceWidgetFallbackSvg, widgetSeries, sparklinePath, priceWidgetImageUrl,
} from '@/utils/priceWidget.js';

const card = { slug: 'charizard-base-set-4', name: 'Charizard <Holo> & "Co"', set_name: 'Base Set', category: 'pokemon' };

describe('price widget snippet', () => {
  it('is a followed link to the price page around the live image', () => {
    const html = priceWidgetSnippet(card);
    expect(html).toMatch(/^<a href="https:\/\/cardpop\.com\.au\/prices\/pokemon\/charizard-base-set-4"/);
    expect(html).toContain(`src="${priceWidgetImageUrl('charizard-base-set-4')}"`);
    expect(html).toContain('Charizard &lt;Holo&gt; &amp; &quot;Co&quot;');
    expect(html).not.toMatch(/nofollow|<iframe|<script/);
  });
});

describe('price widget image', () => {
  const history = [
    { snapshot_date: '2026-11-05', raw_avg: 200, graded_avg: null },
    { snapshot_date: '2026-11-06', raw_avg: 180, graded_avg: 900 },
  ];

  it('shows only figures from the snapshots and escapes the name', () => {
    const svg = priceWidgetSvg(card, history);
    expect(svg).toContain('$180.00');
    expect(svg).toContain('$900.00');
    expect(svg).toContain('−10.0% · 1d');
    expect(svg).toContain('Charizard &lt;Holo&gt;');
    expect(svg).not.toContain('<Holo>');
    expect(svg).toContain('Updated 6 Nov 2026');
  });

  it('says a price is coming rather than inventing one', () => {
    const svg = priceWidgetSvg(card, []);
    expect(svg).toContain('AUD price coming soon');
    expect(svg).not.toMatch(/\$\d/);
  });

  it('falls back to graded averages for the sparkline', () => {
    expect(widgetSeries([
      { snapshot_date: '2026-11-01', graded_avg: 1 },
      { snapshot_date: '2026-11-08', raw_avg: null, graded_avg: 2 },
    ])).toEqual({ kind: 'graded', values: [1, 2], spanDays: 7 });
    expect(sparklinePath([5], { x: 0, y: 0, w: 10, h: 10 })).toBe('');
    expect(sparklinePath([1, 1], { x: 0, y: 0, w: 10, h: 10 })).toBe('M0.0 5.0 L10.0 5.0');
  });

  it('has a neutral image for unknown cards', () => {
    expect(priceWidgetFallbackSvg()).toContain('<svg');
    expect(priceWidgetSvg(null)).toBe(priceWidgetFallbackSvg());
  });
});
