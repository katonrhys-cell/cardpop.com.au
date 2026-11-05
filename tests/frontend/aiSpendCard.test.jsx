import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiServerClient.js', () => ({ default: { fetch: fetchMock } }));

import AiSpendCard from '@/components/admin/AiSpendCard.jsx';

const period = { label: 'Q2 FY2026-27 — current BAS quarter', start: new Date(2026, 9, 1), end: new Date(2026, 11, 31) };

beforeEach(() => { fetchMock.mockReset(); });

describe('AiSpendCard', () => {
  it('shows the cost in AUD, its share of earnings and a row per feature', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [{ feature: 'grade_estimate', model: 'claude-sonnet-5-5', calls: 12, members: 5, input_tokens: 30000, output_tokens: 9000, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 6 }],
        totals: { calls: 12, cost_usd: 6, cost_aud: 9 },
        usd_to_aud: 1.5,
        allowances: { card_scan: { limit: 300 }, grade_estimate: { limit: 30 }, card_description: { limit: 0 } },
      }),
    });
    render(<AiSpendCard period={period} earningsEx={90} />);
    expect(await screen.findByText('Grade estimates')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    expect(screen.getAllByText(/\$9\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/unlimited AI descriptions/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/admin\/ai-usage\?from=2026-10-01&to=\d{4}-\d{2}-\d{2}$/);
  });

  it('says so when nothing was recorded', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: [], totals: { calls: 0, cost_usd: 0, cost_aud: 0 }, usd_to_aud: 1.5, allowances: {} }) });
    render(<AiSpendCard period={period} earningsEx={0} />);
    expect(await screen.findByText('No AI calls recorded in this period.')).toBeInTheDocument();
  });

  it('shows the error when the endpoint fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Could not load AI usage.' }) });
    render(<AiSpendCard period={period} earningsEx={0} />);
    await waitFor(() => expect(screen.getByText('Could not load AI usage.')).toBeInTheDocument());
  });
});
