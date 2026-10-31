import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { THUMBNAILS_SINCE, THUMB_SUFFIX } from '@/utils/imageUrl.js';

// The live strip shows cards at 80×112 px; it must serve the 480 px companion
// thumbnail when one exists rather than the full upload. And it must never
// open a realtime channel: it is rendered to every anonymous visitor of the
// homepage and marketplace, and the open subscriptions were what kept
// Supabase's WAL poller running around the clock.

const h = vi.hoisted(() => ({ rows: [] }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder), limit: vi.fn(() => builder),
    then: (res, rej) => Promise.resolve({ data: h.rows, error: null }).then(res, rej),
  };
  // getCardImage() builds public URLs through supabase.storage.
  const storage = { from: () => ({ getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.test/object/public/vault-images/${path}` } }) }) };
  return { supabase: { from: vi.fn(() => builder), channel: vi.fn(), removeChannel: vi.fn(), storage } };
});

import { supabase } from '@/lib/supabaseClient.js';
import LiveActivityTicker, { tickerImageUrl, loadTickerEvents } from '@/components/LiveActivityTicker.jsx';

describe('tickerImageUrl', () => {
  it('uses the companion thumbnail for uploads that have one', () => {
    const ts = THUMBNAILS_SINCE + 1000;
    const url = tickerImageUrl({ card_image: `user/${ts}.webp` });
    expect(url).toContain(`user/${ts}${THUMB_SUFFIX}`);
  });

  it('falls back to the full image for older uploads', () => {
    const ts = THUMBNAILS_SINCE - 1000;
    const url = tickerImageUrl({ card_image: `user/${ts}.jpg` });
    expect(url).toContain(`user/${ts}.jpg`);
    expect(url).not.toContain(THUMB_SUFFIX);
  });

  it('prefers card_image, then the first vault image, then nothing', () => {
    const ts = THUMBNAILS_SINCE + 5000;
    expect(tickerImageUrl({ vault_images: [{ storage_path: `u/${ts}.webp` }] })).toContain(`u/${ts}${THUMB_SUFFIX}`);
    expect(tickerImageUrl({})).toBeNull();
    expect(tickerImageUrl(null)).toBeNull();
  });
});

describe('LiveActivityTicker', () => {
  it('seeds from the two listing queries and opens no realtime channel', async () => {
    h.rows = [{ id: 'l1', price_aud: 12, status: 'active', created_at: new Date().toISOString(), vault_item: { card_name: 'Pikachu' } }];
    // The same stub rows answer both the "listed" and "sold" queries, so the
    // card shows once per kind.
    const { findAllByText } = render(<MemoryRouter><LiveActivityTicker /></MemoryRouter>);
    expect(await findAllByText('Pikachu')).toHaveLength(2);
    await waitFor(() => expect(supabase.from).toHaveBeenCalledTimes(2));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('loadTickerEvents merges newest-first and caps the strip', async () => {
    const now = Date.now();
    h.rows = Array.from({ length: 10 }, (_, i) => ({
      id: `l${i}`, price_aud: 1, status: 'active', created_at: new Date(now - i * 1000).toISOString(), updated_at: new Date(now - i * 1000).toISOString(),
      vault_item: { card_name: `Card ${i}` },
    }));
    const events = await loadTickerEvents();
    expect(events.length).toBeLessThanOrEqual(16);
    expect(events[0].at.getTime()).toBeGreaterThanOrEqual(events[events.length - 1].at.getTime());
  });
});
