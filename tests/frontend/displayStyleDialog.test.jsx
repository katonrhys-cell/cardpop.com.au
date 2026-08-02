import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// The vault's quick style switcher: picks a style with the real picker and
// saves through the dedicated PATCH endpoint (never the full-replace PUT,
// which would recompute listing_type and unlist the card).

const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({
  default: { fetch: mockFetch },
  apiServerClient: { fetch: mockFetch },
}));
vi.mock('@/contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: { id: 'u1', subscription_tier: 'ultimate' } }),
}));
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

const DisplayStyleDialog = (await import('@/components/vault/DisplayStyleDialog.jsx')).default;

const card = {
  id: '11111111-2222-3333-4444-555555555555',
  card_name: 'Charizard',
  display_style: 'classic',
  card_image: 'https://cdn/object/charizard.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, displayStyle: 'holographic' }),
  });
});

describe('DisplayStyleDialog', () => {
  it('saves the picked style through the display-style PATCH endpoint', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DisplayStyleDialog open={true} onOpenChange={onOpenChange} card={card} onSaved={onSaved} />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /Holographic/i }));
    await userEvent.click(screen.getByRole('button', { name: /Save style/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('holographic'));
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(`/vault/items/${card.id}/display-style`);
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ displayStyle: 'holographic' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('surfaces the server error and keeps the dialog open on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Holographic is a Ultimate display style. Upgrade to use it.' }),
    });
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DisplayStyleDialog open={true} onOpenChange={onOpenChange} card={card} onSaved={onSaved} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Save style/i }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
