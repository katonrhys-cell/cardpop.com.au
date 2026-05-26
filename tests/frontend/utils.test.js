import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils.js';

describe('cn (class name utility)', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('merges conflicting Tailwind classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes via objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });
});
