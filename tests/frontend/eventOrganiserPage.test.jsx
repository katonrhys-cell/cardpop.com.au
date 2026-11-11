import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ org: null, events: [], ilike: null }));
const auth = vi.hoisted(() => ({ user: null, isAdmin: false }));
vi.mock('@/lib/supabaseClient.js', () => {
  const builder = (table) => {
    const q = {
      select: () => q, eq: () => q, order: () => q, limit: () => q,
      ilike: (_col, pattern) => { db.ilike = pattern; return q; },
      maybeSingle: async () => ({ data: db.org, error: null }),
      then: (resolve) => resolve({ data: table === 'events_public' ? db.events : [], error: null }),
    };
    return q;
  };
  return { supabase: { from: builder } };
});
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: auth.user, isAdmin: auth.isAdmin }) }));
vi.mock('@/components/events/OrganiserPageEditor.jsx', () => ({ default: () => <div role="dialog">editor</div> }));
vi.mock('@/components/EventRsvp.jsx', () => ({ default: () => null }));
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));

import EventOrganiserPage from '@/pages/community/EventOrganiserPage.jsx';

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/events/organisers/:slug" element={<EventOrganiserPage />} /></Routes>
  </MemoryRouter>,
);

describe('EventOrganiserPage', () => {
  it("lists the organiser's upcoming and past events, co-hosted ones included", async () => {
    db.org = { id: 'cc', name: 'Cardcore', slug: 'cardcore', logo_url: 'https://cdn.test/cc.jpg' };
    db.events = [
      { id: 'a', slug: 'future', title: 'Hustlemania 2099', status: 'approved', start_date: '2099-01-23', end_date: '2099-01-24', organizer_name: 'Cardcore' },
      { id: 'b', slug: 'old', title: 'Cardcore Vol. 1', status: 'completed', start_date: '2020-05-01', organizer_name: 'Cardcore & Friends' },
      { id: 'c', slug: 'other', title: 'Not theirs', status: 'approved', start_date: '2099-02-01', organizer_name: 'Hardcardcore Club' },
    ];
    renderAt('/events/organisers/cardcore');
    expect(await screen.findByRole('heading', { level: 1, name: 'Cardcore' })).toBeInTheDocument();
    expect(screen.getByText('Hustlemania 2099')).toBeInTheDocument();
    expect(screen.getByText('Cardcore Vol. 1')).toBeInTheDocument();
    expect(screen.queryByText('Not theirs')).not.toBeInTheDocument();
    expect(screen.getByText(/1 upcoming · 1 past event on CardPop/)).toBeInTheDocument();
    expect(db.ilike).toBe('%Cardcore%');
    expect(screen.getByRole('img', { name: 'Cardcore logo' })).toBeInTheDocument();
  });

  it('says so for an unknown organiser', async () => {
    db.org = null;
    renderAt('/events/organisers/nobody');
    expect(await screen.findByText('Organiser not found')).toBeInTheDocument();
  });
});

describe('EventOrganiserPage — profile and editing', () => {
  const org = {
    id: 'oz', name: 'Oz Comic-Con', slug: 'oz-comic-con', logo_url: null, owner_id: 'owner-1',
    description: 'Australia’s biggest pop-culture show.',
    website_url: 'https://ozcomiccon.com', instagram_url: 'https://instagram.com/ozcomiccon',
    facebook_url: 'javascript:alert(1)', youtube_url: null,
  };
  beforeEach(() => { auth.user = null; auth.isAdmin = false; db.org = org; db.events = []; });

  it('shows the description and only safe links', async () => {
    renderAt('/events/organisers/oz-comic-con');
    expect(await screen.findByText('Australia’s biggest pop-culture show.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Website/ })).toHaveAttribute('href', 'https://ozcomiccon.com');
    expect(screen.getByRole('link', { name: /Instagram/ })).toHaveAttribute('rel', expect.stringContaining('nofollow'));
    expect(screen.queryByRole('link', { name: /Facebook/ })).not.toBeInTheDocument();
  });

  it('offers Edit page to the owner and opens the editor', async () => {
    auth.user = { id: 'owner-1' };
    renderAt('/events/organisers/oz-comic-con');
    fireEvent.click(await screen.findByRole('button', { name: /Edit page/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('editor');
  });

  it('offers Edit page to an admin', async () => {
    auth.user = { id: 'admin-1' };
    auth.isAdmin = true;
    renderAt('/events/organisers/oz-comic-con');
    expect(await screen.findByRole('button', { name: /Edit page/ })).toBeInTheDocument();
  });

  it('does not offer Edit page to visitors or other members', async () => {
    renderAt('/events/organisers/oz-comic-con');
    await screen.findByText('Australia’s biggest pop-culture show.');
    expect(screen.queryByRole('button', { name: /Edit page/ })).not.toBeInTheDocument();
    auth.user = { id: 'someone-else' };
    cleanup();
    renderAt('/events/organisers/oz-comic-con');
    await screen.findByText('Australia’s biggest pop-culture show.');
    expect(screen.queryByRole('button', { name: /Edit page/ })).not.toBeInTheDocument();
  });
});
