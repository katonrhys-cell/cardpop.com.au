import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

// The brand radii are custom theme keys, so tailwind-merge has to be told about
// them — otherwise an override like rounded-full is kept alongside the base
// rounded-input and loses on CSS source order (the search bar rendered square).
describe('cn — brand theme tokens', () => {
  it('lets a radius override replace a brand radius', () => {
    expect(cn('rounded-input border', 'rounded-full')).toBe('border rounded-full');
    expect(cn('rounded-button', 'rounded-xl')).toBe('rounded-xl');
    expect(cn('rounded-card', 'rounded-none')).toBe('rounded-none');
    expect(cn('rounded-lg', 'rounded-pill')).toBe('rounded-pill');
  });

  it('keeps per-corner radii alongside a brand radius', () => {
    expect(cn('rounded-card', 'rounded-t-none')).toBe('rounded-card rounded-t-none');
  });

  it('lets min-h/min-w overrides replace the touch-target minimum', () => {
    expect(cn('min-h-touch', 'min-h-0')).toBe('min-h-0');
    expect(cn('min-w-touch', 'min-w-0')).toBe('min-w-0');
  });
});
