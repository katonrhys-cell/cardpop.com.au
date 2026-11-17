import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const tables = vi.hoisted(() => ({ event_scan_runs: [], event_scan_sources: [], event_scan_candidates: [] }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: (table) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        then: (ok, err) => Promise.resolve({ data: tables[table], count: tables.unread ?? 0, error: null }).then(ok, err),
      };
      return query;
    },
    auth: { getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }) },
  },
}));

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient', () => ({ default: { fetch: apiFetch } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { default: EventScanPanel } = await import('@/components/EventScanPanel.jsx');

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const openSources = async () => {
  render(<EventScanPanel isOpen onClose={() => {}} />);
  const tab = await screen.findByRole('tab', { name: 'What it searches for' });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
};

beforeEach(() => {
  vi.clearAllMocks();
  tables.event_scan_runs = [
    { id: 'r1', status: 'completed', trigger: 'cron', scope: 'instagram', started_at: new Date().toISOString(), queries_run: 3, candidates_found: 5, pages_fetched: 5, events_created: 2, duplicates_skipped: 1, warnings: [] },
    { id: 'r2', status: 'completed', trigger: 'cron', scope: 'web', started_at: new Date().toISOString(), queries_run: 12, candidates_found: 40, pages_fetched: 9, events_created: 1, duplicates_skipped: 0, warnings: [] },
  ];
  tables.event_scan_sources = [
    { id: 's1', kind: 'instagram_tagged', value: 'tagged', label: 'Posts that tag CardPop', is_active: true },
    { id: 's2', kind: 'instagram_account', value: 'cardshowsau', label: 'Card Shows AU', is_active: true },
    { id: 's3', kind: 'search_query', value: 'card show sydney', is_active: true },
  ];
  apiFetch.mockImplementation(async (path) => (
    path === '/event-scan/instagram/status' ? ok({ configured: true, connected: true, username: 'cardpop.com.au' }) : ok({})
  ));
});

describe('EventScanPanel — Instagram', () => {
  it('labels an Instagram run in its own words', async () => {
    render(<EventScanPanel isOpen onClose={() => {}} />);

    expect(await screen.findByText('3 accounts checked')).toBeTruthy();
    expect(screen.getByText('5 posts read')).toBeTruthy();
    expect(screen.getByText('12 queries')).toBeTruthy();
  });

  it('shows the connection, the account sources and no delete on the tagged-posts row', async () => {
    await openSources();

    expect(await screen.findByText(/Connected as @cardpop\.com\.au/)).toBeTruthy();
    expect(screen.getByText('@cardshowsau')).toBeTruthy();
    expect(screen.getByText('Posts that tag CardPop')).toBeTruthy();
    expect(screen.getByLabelText('Remove @cardshowsau')).toBeTruthy();
    expect(screen.queryByLabelText('Remove Posts that tag CardPop')).toBeNull();
    expect(screen.getByRole('button', { name: /Scan Instagram now/ }).disabled).toBe(false);
  });

  it('keeps "Scan Instagram now" off and says why until the account is connected', async () => {
    apiFetch.mockImplementation(async () => ok({ configured: false }));
    await openSources();

    expect(await screen.findByText(/Not connected yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Scan Instagram now/ }).disabled).toBe(true);
  });

  it('adds the organisers\' accounts to the list', async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === '/event-scan/instagram/import-organisers') {
        return ok({ added: [{ id: 's9', kind: 'instagram_account', value: 'shirecollexpo', is_active: true }], alreadyListed: 1 });
      }
      return ok({ configured: true, connected: true, username: 'cardpop.com.au' });
    });
    await openSources();

    fireEvent.click(await screen.findByRole('button', { name: /Add organisers/ }));

    await waitFor(() => expect(screen.getByText('@shirecollexpo')).toBeTruthy());
  });
});

describe('EventScanPanel — backlog', () => {
  it('shows how many found pages are unread and offers to read the next batch', async () => {
    tables.unread = 447;
    tables.event_scan_runs = [
      { id: 'r3', status: 'completed', trigger: 'cron', scope: 'backlog', started_at: new Date().toISOString(), queries_run: 6, candidates_found: 30, pages_fetched: 28, events_created: 9, duplicates_skipped: 4, warnings: [] },
    ];
    render(<EventScanPanel isOpen onClose={() => {}} />);

    expect(await screen.findByText(/447 found pages not read yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read next batch' })).toBeTruthy();
    expect(screen.getByText('6 listing pages')).toBeTruthy();
    tables.unread = 0;
  });

  it('says nothing about a backlog when there is none', async () => {
    tables.unread = 0;
    render(<EventScanPanel isOpen onClose={() => {}} />);

    await screen.findByText('12 queries');
    expect(screen.queryByText(/not read yet/)).toBeNull();
  });
});
