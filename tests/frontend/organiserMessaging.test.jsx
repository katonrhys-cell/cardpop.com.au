import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ org: null }));
const auth = vi.hoisted(() => ({ user: null, isAdmin: false }));
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/lib/supabaseClient.js', () => {
  const builder = () => {
    const q = {
      select: () => q, eq: () => q, order: () => q, limit: () => q, ilike: () => q,
      maybeSingle: async () => ({ data: db.org, error: null }),
      then: (resolve) => resolve({ data: [], error: null }),
    };
    return q;
  };
  return { supabase: { from: builder } };
});
vi.mock('@/lib/apiServerClient.js', () => ({ default: api }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: auth.user, isAdmin: auth.isAdmin }) }));
vi.mock('@/components/events/OrganiserPageEditor.jsx', () => ({ default: () => null }));
vi.mock('@/components/EventRsvp.jsx', () => ({ default: () => null }));
vi.mock('@/components/SEOHead.jsx', () => ({ default: () => null }));

import EventOrganiserPage from '@/pages/community/EventOrganiserPage.jsx';
import { organiserMessageProblem, organiserMessageTopicLabel } from '@/utils/organiserMessages.js';

const renderPage = () => render(
  <MemoryRouter initialEntries={['/events/organisers/oz-comic-con']}>
    <Routes><Route path="/events/organisers/:slug" element={<EventOrganiserPage />} /></Routes>
  </MemoryRouter>,
);
const json = (body, ok = true) => ({ ok, json: async () => body });
const org = { id: 'oz', name: 'Oz Comic-Con', slug: 'oz-comic-con', logo_url: null, owner_id: 'owner-1' };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  auth.isAdmin = false;
  db.org = org;
});

describe('Messaging an organiser from their page', () => {
  it('asks a signed-out visitor to sign in, and brings them back to the page', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Message' }));
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fevents%2Forganisers%2Foz-comic-con');
    expect(screen.queryByLabelText('Your message')).not.toBeInTheDocument();
  });

  it('sends a member’s message through the screened API route', async () => {
    auth.user = { id: 'member-1', email: 'maya@example.com' };
    api.fetch.mockResolvedValue(json({ ok: true }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Message Oz Comic-Con/ }));

    const send = screen.getByRole('button', { name: /Send message/ });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('What’s it about?'), { target: { value: 'vendor' } });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Do you have trader tables left for March?' } });
    expect(screen.getByText(/maya@example.com/)).toBeInTheDocument();
    fireEvent.click(send);

    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
    const [path, init] = api.fetch.mock.calls[0];
    expect(path).toBe('/organiser-messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ organiserId: 'oz', topic: 'vendor', message: 'Do you have trader tables left for March?' });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.queryByLabelText('Your message')).not.toBeInTheDocument();
  });

  it('shows the server’s reason when a message is refused, and keeps what was typed', async () => {
    auth.user = { id: 'member-1', email: 'maya@example.com' };
    api.fetch.mockResolvedValue(json({ error: 'You can send Oz Comic-Con 3 messages a day. Please try again tomorrow.' }, false));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Message' }));
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'One more question about parking.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send message/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/3 messages a day/)));
    expect(screen.getByLabelText('Your message')).toHaveValue('One more question about parking.');
  });

  it('says the message goes to CardPop when nobody has claimed the page', async () => {
    db.org = { ...org, owner_id: null };
    auth.user = { id: 'member-1', email: 'maya@example.com' };
    renderPage();
    expect(await screen.findByText(/the CardPop team will pass it on/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    expect(screen.getByText(/hasn’t linked an account to this page yet/)).toBeInTheDocument();
  });

  it('shows the owner their inbox instead of the form', async () => {
    auth.user = { id: 'owner-1', email: 'owner@show.com.au' };
    api.fetch.mockResolvedValue(json({
      organiser: { id: 'oz' },
      messages: [{ id: 'm1', sender_name: 'Maya', sender_email: 'maya@example.com', topic: 'feedback', body: 'Great show, long queue.', created_at: '2026-11-16T01:00:00Z' }],
    }));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Your messages' })).toBeInTheDocument();
    expect(await screen.findByText('Great show, long queue.')).toBeInTheDocument();
    expect(api.fetch).toHaveBeenCalledWith('/organiser-messages/inbox');
    expect(screen.getByRole('link', { name: /Reply by email/ })).toHaveAttribute('href', expect.stringMatching(/^mailto:maya@example\.com\?subject=/));
    expect(screen.queryByRole('button', { name: 'Message' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Feedback & questions/ })).not.toBeInTheDocument();
  });
});

describe('organiserMessages helpers', () => {
  it('checks length and labels topics', () => {
    expect(organiserMessageProblem('hi')).toMatch(/at least 10/);
    expect(organiserMessageProblem('x'.repeat(2001))).toMatch(/under 2000/);
    expect(organiserMessageProblem('A real question here.')).toBe('');
    expect(organiserMessageTopicLabel('vendor')).toBe('Trader or vendor enquiry');
    expect(organiserMessageTopicLabel('nope')).toBe('Message');
  });
});
