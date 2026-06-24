import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

// Drive framer-motion's animate synchronously: jump straight to the target.
const stop = vi.fn();
vi.mock('framer-motion', () => ({
  animate: (_from, to, opts) => { opts.onUpdate(to); return { stop }; },
}));

import { useAnimatedText } from '@/hooks/use-animated-text.jsx';

describe('useAnimatedText', () => {
  it('reveals up to the animated cursor (full text when complete)', () => {
    const { result } = renderHook(() => useAnimatedText('Hello'));
    expect(result.current).toBe('Hello');
  });

  it('re-animates when the text changes', () => {
    const { result, rerender } = renderHook(({ t }) => useAnimatedText(t), {
      initialProps: { t: 'Hi' },
    });
    expect(result.current).toBe('Hi');
    rerender({ t: 'Hi there' });
    expect(result.current).toBe('Hi there');
  });

  it('stops the animation on unmount', () => {
    const { unmount } = renderHook(() => useAnimatedText('x'));
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
