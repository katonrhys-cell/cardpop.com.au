import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The full-screen card inspector: a magnifying lens plus a whole-image size
// control, so the card itself can be enlarged and panned.

const CardMicroscope = (await import('@/components/CardMicroscope.jsx')).default;

const open = () =>
  render(<CardMicroscope isOpen onClose={() => {}} imageUrl="https://example.test/card.jpg" altText="Card" />);

describe('CardMicroscope', () => {
  it('renders nothing when closed', () => {
    render(<CardMicroscope isOpen={false} onClose={() => {}} imageUrl="x.jpg" altText="Card" />);
    expect(screen.queryByRole('img', { name: 'Card' })).toBeNull();
  });

  it('offers a lens control and a separate whole-image size control', () => {
    open();
    expect(screen.getByRole('slider', { name: 'Magnification' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Image size' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enlarge image' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shrink image' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fit image to screen' })).toBeTruthy();
    expect(screen.getByText(/Image 100%/)).toBeTruthy();
  });

  it('enlarges the whole image independently of the lens', () => {
    open();
    const enlarge = screen.getByRole('button', { name: 'Enlarge image' });
    fireEvent.click(enlarge);
    fireEvent.click(enlarge);
    expect(screen.getByText(/Lens 3x/)).toBeTruthy();
    expect(screen.getByText(/Image 150%/)).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Image size' }).value).toBe('1.5');
    expect(screen.getByRole('slider', { name: 'Magnification' }).value).toBe('3');
  });

  it('cannot shrink below fit-to-screen and resets with Fit', () => {
    open();
    expect(screen.getByRole('button', { name: 'Shrink image' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Fit image to screen' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge image' }));
    expect(screen.getByRole('button', { name: 'Shrink image' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Fit image to screen' }));
    expect(screen.getByText(/Image 100%/)).toBeTruthy();
  });

  it('drives both controls from the keyboard', () => {
    open();
    act(() => {
      fireEvent.keyDown(window, { key: ']' });
      fireEvent.keyDown(window, { key: ']' });
      fireEvent.keyDown(window, { key: '+' });
    });
    expect(screen.getByText(/Image 150%/)).toBeTruthy();
    expect(screen.getByText(/Lens 3.5x/)).toBeTruthy();
    act(() => {
      fireEvent.keyDown(window, { key: '0' });
      fireEvent.keyDown(window, { key: '-' });
    });
    expect(screen.getByText(/Image 100%/)).toBeTruthy();
    expect(screen.getByText(/Lens 3x/)).toBeTruthy();
  });

  it('clamps the image size to its range', () => {
    open();
    const slider = screen.getByRole('slider', { name: 'Image size' });
    fireEvent.change(slider, { target: { value: '4' } });
    expect(screen.getByText(/Image 400%/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enlarge image' }).disabled).toBe(true);
    act(() => {
      fireEvent.keyDown(window, { key: ']' });
    });
    expect(screen.getByText(/Image 400%/)).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<CardMicroscope isOpen onClose={onClose} imageUrl="x.jpg" altText="Card" />);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
