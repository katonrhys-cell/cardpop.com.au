import { describe, it, expect } from 'vitest';
import { buildCardSearchOr, CARD_SEARCH_COLUMNS } from '@/src/utils/cardSearchFilter.js';

describe('buildCardSearchOr', () => {
  it('matches the term against every card search column', () => {
    expect(buildCardSearchOr('pikachu')).toBe(
      CARD_SEARCH_COLUMNS.map((c) => `${c}.ilike."%pikachu%"`).join(',')
    );
  });

  it('trims the term', () => {
    expect(buildCardSearchOr('  4/102  ')).toContain('card_number.ilike."%4/102%"');
  });

  it('quotes the pattern so commas and parens cannot break the or() syntax', () => {
    const filter = buildCardSearchOr('foo,bar(baz)');
    expect(filter).toContain('card_name.ilike."%foo,bar(baz)%"');
    // The comma inside the quoted literal must not create a fourth condition.
    expect(filter.split('.ilike.')).toHaveLength(CARD_SEARCH_COLUMNS.length + 1);
  });

  it('escapes LIKE wildcards so a term cannot match everything', () => {
    expect(buildCardSearchOr('100%')).toContain('.ilike."%100\\\\%%"');
  });

  it('escapes double quotes so the quoted literal cannot be terminated early', () => {
    expect(buildCardSearchOr('say "hi"')).toContain('.ilike."%say \\"hi\\"%"');
  });

  it('handles empty and non-string input safely', () => {
    expect(buildCardSearchOr('')).toContain('card_name.ilike."%%"');
    expect(buildCardSearchOr(null)).toContain('card_name.ilike."%%"');
  });
});
