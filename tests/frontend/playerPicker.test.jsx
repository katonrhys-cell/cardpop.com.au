import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const fetchPublishedPlayers = vi.hoisted(() => vi.fn());
vi.mock('@/lib/players.js', () => ({ fetchPublishedPlayers }));

import PlayerPicker from '@/components/PlayerPicker.jsx';
import { resetPlayersCache } from '@/hooks/usePlayers.js';

const PLAYERS = [
  { id: 'p1', slug: 'michael-jordan', name: 'Michael Jordan', sport: 'NBA', team: 'Chicago Bulls', aliases: ['MJ'], headline: 'Six rings.', sort_order: 1 },
  { id: 'p2', slug: 'victor-wembanyama', name: 'Victor Wembanyama', sport: 'NBA', team: 'San Antonio Spurs', aliases: ['Wemby'], headline: 'The alien.', sort_order: 5 },
  { id: 'p3', slug: 'nick-daicos', name: 'Nick Daicos', sport: 'AFL', team: 'Collingwood', aliases: [], headline: 'Magpie.', sort_order: 17 },
];

beforeAll(() => {
  // cmdk + Radix need these in happy-dom.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  vi.clearAllMocks();
  resetPlayersCache();
  fetchPublishedPlayers.mockResolvedValue(PLAYERS);
});

const renderPicker = (props = {}) => render(
  <MemoryRouter><PlayerPicker {...props} /></MemoryRouter>,
);

describe('PlayerPicker', () => {
  it('loads the published list once and lets the seller search by nickname', async () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });

    const trigger = await screen.findByRole('combobox');
    await waitFor(() => expect(trigger).not.toBeDisabled());
    expect(fetchPublishedPlayers).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    const input = await screen.findByPlaceholderText(/type a name/i);
    fireEvent.change(input, { target: { value: 'wemby' } });

    const option = await screen.findByText('Victor Wembanyama');
    expect(screen.queryByText('Michael Jordan')).toBeNull();
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2', slug: 'victor-wembanyama' }));
  });

  it('shows the chosen player with a link to their page that opens in a new tab', async () => {
    renderPicker({ value: 'p3', onSelect: vi.fn() });

    const link = await screen.findByRole('link', { name: /view player page/i });
    expect(link).toHaveAttribute('href', '/players/nick-daicos');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getAllByText('Nick Daicos').length).toBeGreaterThan(0);
  });

  it('clears the tag from the remove button', async () => {
    const onSelect = vi.fn();
    renderPicker({ value: 'p1', onSelect });
    fireEvent.click(await screen.findByRole('button', { name: /remove player/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('degrades to a one-line note when the players table is unreachable', async () => {
    fetchPublishedPlayers.mockRejectedValue(new Error('relation "players" does not exist'));
    renderPicker({ onSelect: vi.fn() });
    expect(await screen.findByText(/player tagging is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
