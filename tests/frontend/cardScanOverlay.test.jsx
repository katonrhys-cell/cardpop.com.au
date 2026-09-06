import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// The full-screen visual that plays while a card is being identified.

const CardScanOverlay = (await import('@/components/CardScanOverlay.jsx')).default;

describe('CardScanOverlay', () => {
  it('renders nothing when closed', () => {
    render(<CardScanOverlay open={false} label="Reading the card" />);
    expect(screen.queryByTestId('card-scan-overlay')).toBeNull();
  });

  it('shows the phase label and the photo being scanned', () => {
    render(<CardScanOverlay open imageUrl="blob:card-front" label="Reading the card" />);
    expect(screen.getByTestId('card-scan-overlay')).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Reading the card');
    expect(document.querySelector('img[src="blob:card-front"]')).toBeTruthy();
  });

  it('still scans a frame when there is no photo to show', () => {
    render(<CardScanOverlay open label="Matching the catalog" />);
    expect(screen.getByTestId('card-scan-overlay')).toBeTruthy();
    expect(document.querySelector('.cardscan__sweep')).toBeTruthy();
  });

  it('offers cancel only when the caller can act on it', () => {
    const { rerender } = render(<CardScanOverlay open label="Reading the card" />);
    expect(screen.queryByRole('button', { name: /cancel scan/i })).toBeNull();

    rerender(<CardScanOverlay open label="Reading the card" onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /cancel scan/i })).toBeTruthy();
  });

  it('cancels on click and on Escape', async () => {
    const onCancel = vi.fn();
    render(<CardScanOverlay open label="Reading the card" onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: /cancel scan/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('does not bind Escape when there is nothing to cancel', async () => {
    render(<CardScanOverlay open label="Reading the card" />);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('card-scan-overlay')).toBeTruthy();
  });

  // The overlay covers the form underneath, so the page behind it must not
  // scroll while it is up — and must get its scrolling back when it closes.
  it('locks page scroll while open and restores it on close', async () => {
    const { rerender } = render(<CardScanOverlay open label="Reading the card" />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<CardScanOverlay open={false} label="Reading the card" />);
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });
});
