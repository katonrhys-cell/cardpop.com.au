import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const fresh = new Date().toISOString();
vi.mock('@/lib/homepageData.js', () => ({
  getTrafficSummary: () => Promise.resolve({ data: {
    visitors_30d: 1879, visitors_all_time: 7020, pageviews_30d: 5758, pageviews_all_time: 21000,
    since_date: '2026-04-07', synced_at: fresh,
    search_impressions_30d: 99962, search_clicks_30d: 1377, search_impressions_all_time: 257706,
    search_clicks_all_time: 5118, search_since_date: '2026-05-31', search_synced_at: fresh,
  } }),
  getPlatformStats: () => Promise.resolve({ data: { events: 12 } }),
}));
vi.mock('@/lib/apiServerClient.js', () => ({ apiServerClient: { fetch: vi.fn() } }));

import FeatureEventDialog from '@/components/events/FeatureEventDialog.jsx';
import { OrganiserReachSection, buildOrganiserStats } from '@/components/events/OrganiserReach.jsx';

describe('organiser reach', () => {
  it('shows page views and Google figures on /list-your-event', () => {
    const stats = buildOrganiserStats({
      visitors_30d: 1879, pageviews_30d: 5758, synced_at: fresh,
      search_impressions_30d: 99962, search_clicks_30d: 1377, search_synced_at: fresh,
    }, null);
    render(<OrganiserReachSection stats={stats} />);
    expect(screen.getByText('5,758')).toBeInTheDocument();
    expect(screen.getByText('Page views in the last 30 days')).toBeInTheDocument();
    expect(screen.getByText('99,962')).toBeInTheDocument();
    expect(screen.getByText('1,377')).toBeInTheDocument();
  });

  it('shows the live audience in the Feature dialog', async () => {
    const event = { id: 'e1', title: 'Sydney Card Show', status: 'approved', start_date: '2099-01-01' };
    render(<FeatureEventDialog event={event} onClose={() => {}} />);
    expect(await screen.findByText('5,758')).toBeInTheDocument();
    expect(screen.getByText('CardPop in the last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Page views')).toBeInTheDocument();
    expect(screen.getByText('Clicks from Google')).toBeInTheDocument();
    expect(screen.getByText('Full Feature')).toBeInTheDocument();
  });
});
