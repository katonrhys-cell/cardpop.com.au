import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const stores = [
  { id: 's1', slug: 'swap-itt-melbourne', name: 'Swap Itt', suburb: 'Melbourne', city: 'melbourne', state: 'VIC', owner_id: null },
  { id: 's2', slug: 'taken-shop', name: 'Taken Shop', suburb: 'Carlton', city: 'melbourne', state: 'VIC', owner_id: 'someone' },
];
vi.mock('@/lib/storeDirectory.js', async (orig) => ({
  ...(await orig()),
  fetchClaimableStores: vi.fn(async () => stores),
}));

import OrganiserAccessCard from '@/components/events/OrganiserAccessCard.jsx';

const organiserAccess = (over = {}) => ({ loading: false, request: null, organiser: null, error: null, submit: vi.fn(), ...over });
const storeAccess = (over = {}) => ({ loading: false, requests: [], stores: [], error: null, submit: vi.fn(), ...over });
const show = (props) => render(<MemoryRouter><OrganiserAccessCard {...props} /></MemoryRouter>);

describe('OrganiserAccessCard — organiser and shop owner applications', () => {
  it('offers one application with a dropdown for what the member is applying as', () => {
    show({ access: organiserAccess(), storeAccess: storeAccess() });
    expect(screen.getByText('Do you run card shows, events or a card shop?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply as an organiser or shop owner' }));
    expect(screen.getByText('I’m applying as')).toBeTruthy();
    // Opens on the organiser choice, as before.
    expect(screen.getByLabelText('Organiser or business name')).toBeTruthy();
  });

  it('opens on "Card shop owner" with the shop picked when arriving from a shop page', async () => {
    const access = storeAccess();
    show({ access: organiserAccess(), storeAccess: access, claimStoreSlug: 'swap-itt-melbourne' });
    expect(screen.getByText('Your shop')).toBeTruthy();
    expect(screen.queryByLabelText('Organiser or business name')).toBeNull();
    const send = screen.getByRole('button', { name: /Send request/ });
    await waitFor(() => expect(send.disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Your role at the shop (optional)'), { target: { value: 'Owner' } });
    fireEvent.click(send);
    await waitFor(() => expect(access.submit).toHaveBeenCalledWith({
      storeId: 's1', roleTitle: 'Owner', websiteUrl: null, message: null,
    }));
  });

  it('shows the shops a member manages and a request that is waiting', () => {
    show({
      access: organiserAccess(),
      storeAccess: storeAccess({
        stores: [stores[0]],
        requests: [
          { id: 'r0', store_id: 's1', status: 'approved', store: stores[0] },
          { id: 'r1', store_id: 's9', status: 'pending', store: { name: 'Second Shop' } },
        ],
      }),
    });
    expect(screen.getByText('You manage Swap Itt')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open & edit your shop page/ }).getAttribute('href')).toBe('/card-shops/melbourne/swap-itt-melbourne');
    expect(screen.getByText('Shop owner request with the CardPop team')).toBeTruthy();
    expect(screen.getByText('Second Shop')).toBeTruthy();
  });

  it('shows why a shop request was declined, and still lets an organiser apply for a shop', () => {
    show({
      access: organiserAccess({ organiser: { name: 'Oz Comic-Con', slug: 'oz-comic-con' } }),
      storeAccess: storeAccess({ requests: [{ id: 'r1', store_id: 's1', status: 'rejected', decision_note: 'No link to the shop', store: stores[0] }] }),
    });
    expect(screen.getByText('You manage Oz Comic-Con')).toBeTruthy();
    expect(screen.getByText(/No link to the shop/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply as a shop owner' })).toBeTruthy();
  });

  it('keeps the organiser application working when the shop half fails to load', () => {
    show({ access: organiserAccess(), storeAccess: storeAccess({ error: 'down' }) });
    expect(screen.getByRole('button', { name: 'Apply as an organiser or shop owner' })).toBeTruthy();
  });
});
