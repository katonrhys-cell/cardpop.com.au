import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const db = vi.hoisted(() => ({ result: { data: null, error: null }, calls: [] }));
vi.mock('@/lib/supabaseClient.js', () => ({
  supabase: {
    from: (table) => ({
      select: (cols) => ({
        eq: (col, value) => ({
          maybeSingle: async () => { db.calls.push({ table, cols, col, value }); return db.result; },
        }),
      }),
    }),
  },
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }));

// Stand-ins for the admin forms: they show which row they were given and let
// the test drive save / close.
vi.mock('@/components/EventFormModal.jsx', () => ({
  default: ({ event, onSaved, onClose }) => (
    <div data-testid="event-form">
      {event.title}
      <button type="button" onClick={onSaved}>report saved</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));
vi.mock('@/components/ShopProductForm.jsx', () => ({
  default: ({ product, onSuccess, onCancel }) => (
    <div data-testid="product-form">
      {product.title}
      <button type="button" onClick={onSuccess}>save product</button>
      <button type="button" onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import AdminInPlaceEditor from '@/components/admin/AdminInPlaceEditor.jsx';

beforeEach(() => {
  db.calls = [];
  db.result = { data: null, error: null };
  toastError.mockClear();
});

describe('AdminInPlaceEditor', () => {
  it('opens the shop product form on the full row and refreshes the page after a save', async () => {
    db.result = { data: { id: 'p1', title: '9 Pocket Zip Binder' }, error: null };
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<AdminInPlaceEditor edit={{ kind: 'shopProduct', id: 'p1' }} onClose={onClose} onSaved={onSaved} />);
    expect(await screen.findByTestId('product-form')).toHaveTextContent('9 Pocket Zip Binder');
    expect(db.calls[0]).toEqual({ table: 'shop_products', cols: '*', col: 'id', value: 'p1' });
    fireEvent.click(screen.getByRole('button', { name: 'save product' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('cancelling a product edit closes without refreshing', async () => {
    db.result = { data: { id: 'p1', title: 'Binder' }, error: null };
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<AdminInPlaceEditor edit={{ kind: 'shopProduct', id: 'p1' }} onClose={onClose} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole('button', { name: 'cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opens the event form, and refreshes only once the form closes after a save', async () => {
    db.result = { data: { id: 'e1', title: 'Melbourne Card Show' }, error: null };
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<AdminInPlaceEditor edit={{ kind: 'event', id: 'e1' }} onClose={onClose} onSaved={onSaved} />);
    expect(await screen.findByTestId('event-form')).toHaveTextContent('Melbourne Card Show');
    expect(db.calls[0].table).toBe('events');
    // The form reports a save while still open (a website scan was applied):
    // the page must not reload under the admin.
    fireEvent.click(screen.getByRole('button', { name: 'report saved' }));
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('closing an event that was not saved does not refresh', async () => {
    db.result = { data: { id: 'e1', title: 'Show' }, error: null };
    const onSaved = vi.fn();
    render(<AdminInPlaceEditor edit={{ kind: 'event', id: 'e1' }} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole('button', { name: 'close' }));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says so and closes when the item cannot be loaded', async () => {
    db.result = { data: null, error: { message: 'denied' } };
    const onClose = vi.fn();
    render(<AdminInPlaceEditor edit={{ kind: 'event', id: 'gone' }} onClose={onClose} onSaved={vi.fn()} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith('Could not load that event to edit.');
    expect(screen.queryByTestId('event-form')).toBeNull();
  });
});
