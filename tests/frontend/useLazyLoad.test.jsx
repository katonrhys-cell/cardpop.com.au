import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useLazyLoad } from '@/hooks/useLazyLoad.js';

let ioCallback;
let observed;
let unobserved;

beforeEach(() => {
  ioCallback = null;
  observed = false;
  unobserved = false;
  globalThis.IntersectionObserver = class {
    constructor(cb) { ioCallback = cb; }
    observe() { observed = true; }
    unobserve() { unobserved = true; }
    disconnect() {}
  };
  window.IntersectionObserver = globalThis.IntersectionObserver;
});

function Probe() {
  const [ref, isVisible] = useLazyLoad();
  return <div ref={ref} data-testid="el">{String(isVisible)}</div>;
}

describe('useLazyLoad', () => {
  it('starts hidden and observes the element', () => {
    render(<Probe />);
    expect(screen.getByTestId('el')).toHaveTextContent('false');
    expect(observed).toBe(true);
  });

  it('becomes visible and unobserves once the element intersects', () => {
    render(<Probe />);
    act(() => { ioCallback([{ isIntersecting: true }]); });
    expect(screen.getByTestId('el')).toHaveTextContent('true');
    expect(unobserved).toBe(true);
  });

  it('stays hidden while not intersecting', () => {
    render(<Probe />);
    act(() => { ioCallback([{ isIntersecting: false }]); });
    expect(screen.getByTestId('el')).toHaveTextContent('false');
  });
});
