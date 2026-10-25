import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const auth = { isAuthenticated: false };
vi.mock('@/contexts/AuthContext.jsx', () => ({ useAuth: () => auth }));

const rpc = vi.fn();
const tableOps = { update: vi.fn(), delete: vi.fn(), upsert: vi.fn() };
vi.mock('@/lib/supabaseClient.js', () => {
  const chain = (op) => (...args) => {
    tableOps[op](...args);
    const result = Promise.resolve({ error: null });
    result.eq = () => Promise.resolve({ error: null });
    return result;
  };
  return {
    supabase: {
      rpc: (...args) => rpc(...args),
      from: () => ({ update: chain('update'), delete: chain('delete'), upsert: chain('upsert') }),
    },
  };
});

import EventTicketOffer from '@/components/events/EventTicketOffer.jsx';
import {
  ticketDestination, validateOfferForm, isOfferFormBlank, saveAdminTicketOffer,
  fetchEventTicketOffer, EMPTY_OFFER_FORM,
} from '@/lib/eventTicketOffers.js';

const EVENT_ID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  rpc.mockReset();
  Object.values(tableOps).forEach((fn) => fn.mockReset());
  auth.isAuthenticated = false;
});

describe('ticketDestination', () => {
  const event = { ticket_url: 'https://organiser.example/tickets', website_url: 'https://organiser.example' };

  it('uses the referral link while an offer carries one', () => {
    expect(ticketDestination(event, { referralUrl: 'https://t.example/?ref=cardpop' })).toBe('https://t.example/?ref=cardpop');
  });

  it('falls back to the ticket page, then the website', () => {
    expect(ticketDestination(event, null)).toBe('https://organiser.example/tickets');
    expect(ticketDestination(event, { referralUrl: null })).toBe('https://organiser.example/tickets');
    expect(ticketDestination({ website_url: 'https://organiser.example' }, null)).toBe('https://organiser.example');
    expect(ticketDestination({}, null)).toBeNull();
  });

  it('never uses a non-http referral link', () => {
    expect(ticketDestination(event, { referralUrl: 'javascript:alert(1)' })).toBe('https://organiser.example/tickets');
  });
});

describe('offer form', () => {
  it('validates lengths and the link scheme', () => {
    expect(validateOfferForm(EMPTY_OFFER_FORM)).toBeNull();
    expect(validateOfferForm({ ...EMPTY_OFFER_FORM, referral_url: 'tickets.example' })).toMatch(/https/);
    expect(validateOfferForm({ ...EMPTY_OFFER_FORM, offer_text: 'x'.repeat(121) })).toMatch(/120/);
    expect(validateOfferForm({ ...EMPTY_OFFER_FORM, discount_code: 'x'.repeat(61) })).toMatch(/60/);
  });

  it('treats whitespace as blank', () => {
    expect(isOfferFormBlank({ ...EMPTY_OFFER_FORM, discount_code: '   ' })).toBe(true);
    expect(isOfferFormBlank({ ...EMPTY_OFFER_FORM, discount_code: 'HHXL' })).toBe(false);
  });

  it('upserts a filled form, trimmed', async () => {
    await saveAdminTicketOffer(EVENT_ID, { offer_text: ' 15% off ', discount_code: ' HHXL ', referral_url: '', is_active: true }, null);
    expect(tableOps.upsert).toHaveBeenCalledWith(
      { event_id: EVENT_ID, offer_text: '15% off', discount_code: 'HHXL', referral_url: null, is_active: true },
      { onConflict: 'event_id' },
    );
  });

  it('a blank form does nothing when there is no row', async () => {
    await saveAdminTicketOffer(EVENT_ID, EMPTY_OFFER_FORM, null);
    expect(tableOps.upsert).not.toHaveBeenCalled();
    expect(tableOps.delete).not.toHaveBeenCalled();
  });

  it('a blank form deletes an unused row but switches off one with history', async () => {
    await saveAdminTicketOffer(EVENT_ID, EMPTY_OFFER_FORM, { ticket_clicks: 0, code_reveals: 0 });
    expect(tableOps.delete).toHaveBeenCalled();

    await saveAdminTicketOffer(EVENT_ID, EMPTY_OFFER_FORM, { ticket_clicks: 4, code_reveals: 0 });
    expect(tableOps.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, discount_code: null }));
  });
});

describe('fetchEventTicketOffer', () => {
  it('maps the RPC row and returns null when there is no offer', async () => {
    rpc.mockResolvedValueOnce({ data: [{ offer_text: '15% off', has_code: true, referral_url: null }], error: null });
    expect(await fetchEventTicketOffer(EVENT_ID)).toEqual({ offerText: '15% off', hasCode: true, referralUrl: null });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await fetchEventTicketOffer(EVENT_ID)).toBeNull();
  });
});

describe('EventTicketOffer', () => {
  const offer = { offerText: '15% off GA tickets', hasCode: true, referralUrl: null };
  const renderOffer = (o = offer) => render(
    <MemoryRouter><EventTicketOffer eventId={EVENT_ID} offer={o} /></MemoryRouter>,
  );

  it('renders nothing without a code', () => {
    const { container } = renderOffer({ ...offer, hasCode: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('asks a signed-out visitor to sign in and never fetches the code', () => {
    renderOffer();
    expect(screen.getByText('15% off GA tickets')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in to reveal/i })).toHaveAttribute('href', '/login');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reveals the code to a signed-in member', async () => {
    auth.isAuthenticated = true;
    rpc.mockResolvedValueOnce({ data: 'HHXL15', error: null });
    renderOffer();
    fireEvent.click(screen.getByRole('button', { name: /reveal ticket code/i }));
    await waitFor(() => expect(screen.getByText('HHXL15')).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith('reveal_event_ticket_code', { p_event_id: EVENT_ID });
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });
});
