import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import CategoryCarousel, { CATEGORY_AUTOPLAY_MS } from '@/components/home/CategoryCarousel.jsx';

const Icon = () => <svg />;
const categories = ['Pokémon', 'Magic', 'Yu-Gi-Oh!', 'Sports'].map((name, i) => ({
  name, slug: `cat-${i}`, gradient: 'from-red-500 to-red-700', Icon,
}));

// happy-dom lays nothing out: give tiles a 100px pitch and the track a viewport.
const OFFSET = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get() { return Array.prototype.indexOf.call(this.parentElement?.children ?? [], this) * 100; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 1200 });
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  vi.useRealTimers();
  if (OFFSET) Object.defineProperty(HTMLElement.prototype, 'offsetLeft', OFFSET); else delete HTMLElement.prototype.offsetLeft;
  delete HTMLElement.prototype.clientWidth;
  delete HTMLElement.prototype.scrollWidth;
});

const mount = () => render(<MemoryRouter><CategoryCarousel categories={categories} /></MemoryRouter>);
const settle = () => act(() => { vi.advanceTimersByTime(500); });

describe('CategoryCarousel', () => {
  it('starts with one set of tiles, then adds the looping copies once idle', () => {
    const { container } = mount();
    expect(container.querySelectorAll('a')).toHaveLength(4);
    settle();
    expect(container.querySelectorAll('a')).toHaveLength(12);
  });

  it('keeps the copies out of the tab order and away from screen readers', () => {
    const { container } = mount();
    settle();
    const links = [...container.querySelectorAll('a')];
    expect(links.filter((a) => a.tabIndex === -1)).toHaveLength(8);
    expect(links.filter((a) => !a.closest('[aria-hidden="true"]'))).toHaveLength(4);
  });

  it('centres on the middle copy when the copies appear', () => {
    mount();
    settle();
    expect(screen.getByTestId('category-carousel-track').scrollLeft).toBe(400);
  });

  it('wraps a drift into the first copy forward by one whole copy (and the last copy back)', () => {
    mount();
    settle();
    const track = screen.getByTestId('category-carousel-track');
    track.scrollLeft = 100; // inside the leading copy
    fireEvent.scroll(track);
    settle();
    expect(track.scrollLeft).toBe(500);

    track.scrollLeft = 700; // past the middle copy, into the trailing one
    fireEvent.scroll(track);
    settle();
    expect(track.scrollLeft).toBe(300);
  });

  it('rotates one tile by itself, and holds still after the visitor touches it', () => {
    mount();
    settle();
    const track = screen.getByTestId('category-carousel-track');
    const scrollTo = vi.fn();
    track.scrollTo = scrollTo;
    track.scrollLeft = 400;

    act(() => { vi.advanceTimersByTime(CATEGORY_AUTOPLAY_MS); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 500, behavior: 'smooth' });

    scrollTo.mockClear();
    fireEvent.touchStart(track);
    act(() => { vi.advanceTimersByTime(CATEGORY_AUTOPLAY_MS); });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not rotate by itself under reduced motion', () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    mount();
    settle();
    const track = screen.getByTestId('category-carousel-track');
    const scrollTo = vi.fn();
    track.scrollTo = scrollTo;
    act(() => { vi.advanceTimersByTime(CATEGORY_AUTOPLAY_MS * 3); });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('still has arrows that move the strip', () => {
    mount();
    settle();
    const track = screen.getByTestId('category-carousel-track');
    const scrollTo = vi.fn();
    track.scrollTo = scrollTo;
    track.scrollLeft = 400;
    fireEvent.click(screen.getByLabelText('Next categories'));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 800, behavior: 'smooth' });
    fireEvent.click(screen.getByLabelText('Previous categories'));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  });
});
