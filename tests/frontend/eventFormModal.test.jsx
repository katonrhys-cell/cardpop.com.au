import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: { id: 'user-1' } }),
}));
vi.mock('@/lib/supabaseClient.js', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/lib/apiServerClient.js', () => {
  const client = { fetch: vi.fn() };
  return { default: client, apiServerClient: client };
});
vi.mock('@/utils/compressImage.js', () => ({ compressImage: vi.fn(async (f) => f) }));

import EventFormModal from '@/components/EventFormModal.jsx';

const renderForm = (mode) => render(
  <EventFormModal isOpen={true} onClose={() => {}} event={null} scrapedData={null} onSaved={() => {}} mode={mode} />,
);

describe('EventFormModal — user/admin field parity', () => {
  it('shows the SEO tab to user submissions so their events can rank', () => {
    renderForm('user');
    expect(screen.getByRole('tab', { name: 'SEO' })).toBeInTheDocument();
  });

  it('still hides the admin-only Status and homepage-feature controls in user mode', () => {
    renderForm('user');
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature on Homepage')).not.toBeInTheDocument();
  });

  it('shows every tab in both modes (Member Offer is admin-only)', () => {
    const { unmount } = renderForm('admin');
    const tabNames = (els) => els.map((el) => el.textContent);
    expect(tabNames(screen.getAllByRole('tab'))).toEqual(['Details', 'Venue & Dates', 'Organiser', 'SEO', 'Member Offer']);
    unmount();
    renderForm('user');
    expect(tabNames(screen.getAllByRole('tab'))).toEqual(['Details', 'Venue & Dates', 'Organiser', 'SEO']);
  });

  it('shows the video URL fields (YouTube + Facebook) in user mode', () => {
    renderForm('user');
    // Radix only mounts the active tab's content — switch to Organiser first.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Organiser' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Organiser' }));
    expect(screen.getByLabelText(/YouTube Video URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Facebook Public Post \/ Reel URL/i)).toBeInTheDocument();
  });
});
