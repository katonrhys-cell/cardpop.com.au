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

describe('EventFormModal — photo gallery', () => {
  it('offers the gallery uploader in both modes', () => {
    for (const mode of ['admin', 'user']) {
      const { unmount } = renderForm(mode);
      expect(screen.getByText(/Photo Gallery/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add photos/ })).toBeInTheDocument();
      unmount();
    }
  });

  it("loads an existing event's saved photos in order", () => {
    // User mode skips the admin-only ticket-offer load.
    render(
      <EventFormModal
        isOpen={true} onClose={() => {}} scrapedData={null} onSaved={() => {}} mode="user"
        event={{ id: 'evt-1', title: 'Show', gallery_images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] }}
      />,
    );
    const imgs = screen.getAllByAltText(/^Gallery photo/);
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    expect(screen.getByText('2/24')).toBeInTheDocument();
  });
});

describe('EventFormModal — ticket prices', () => {
  const openOrganiser = () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Organiser' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Organiser' }));
  };

  it('offers every ticket type once entry is not free', () => {
    renderForm('user');
    openOrganiser();
    expect(screen.queryByText('Other Ticket Prices')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('switch')[0]); // Free Entry off
    for (const name of ['Child ticket', 'VIP ticket', 'GA Early Access ticket', 'GA Late Access ticket', 'Group tickets']) {
      expect(screen.getByRole('switch', { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('switch', { name: 'Group tickets' }));
    expect(screen.getByLabelText('People')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add another group price/ }));
    expect(screen.getAllByLabelText('People')).toHaveLength(2);
  });

  it("loads an existing event's ticket prices", () => {
    render(
      <EventFormModal
        isOpen={true} onClose={() => {}} scrapedData={null} onSaved={() => {}} mode="user"
        event={{ id: 'evt-1', title: 'Show', is_free: false, ticket_prices: [{ type: 'vip', price_aud: 60 }, { type: 'group', group_size: 4, price_aud: 50 }] }}
      />,
    );
    openOrganiser();
    expect(screen.getByRole('switch', { name: 'VIP ticket' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Price (AUD)')).toHaveValue(60);
    expect(screen.getByLabelText('People')).toHaveValue(4);
    expect(screen.getByLabelText('Price for the group (AUD)')).toHaveValue(50);
  });
});
