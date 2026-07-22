import { supabase } from '@/lib/supabaseClient.js';

/*
 * Saved shipping addresses (address book).
 *
 * Backed by the `shipping_addresses` table (RLS: a user can only see/manage
 * their own rows). Reads happen client-side here; the authoritative *write*
 * happens server-side in the Stripe webhook after a paid order
 * (see stripeWebhookService → saveBuyerShippingAddress), so an abandoned
 * checkout never persists an address and RLS insert quirks can't bite.
 *
 * The checkout form works in {firstName,lastName,address,address2,…} shape;
 * the table stores {full_name,address_line1,address_line2,…}. These helpers
 * map between the two and are kept pure so they can be unit-tested without a
 * live Supabase client.
 */

// "Ada Lovelace King" → { firstName: 'Ada', lastName: 'Lovelace King' }.
// Everything after the first token is the last name so multi-word surnames
// survive the round-trip.
export function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function joinName(firstName, lastName) {
  return [firstName, lastName].map(s => String(s || '').trim()).filter(Boolean).join(' ');
}

// A saved-address row → the checkout form's shipping shape. `verified: true`
// because the address was validated when it was first saved (the server
// re-validates every address at checkout regardless), so a returning buyer
// isn't forced to re-pick it from the autocomplete suggestions.
export function addressRowToShipping(row, email = '') {
  if (!row) return { email };
  const { firstName, lastName } = splitName(row.full_name);
  return {
    email,
    firstName,
    lastName,
    address: row.address_line1 || '',
    address2: row.address_line2 || '',
    suburb: row.suburb || '',
    state: row.state || '',
    postcode: row.postcode || '',
    verified: true,
  };
}

// A short one-line label for the address picker, e.g. "12 Smith St, Bondi NSW 2026".
export function formatAddressLabel(row) {
  if (!row) return '';
  const line1 = [row.address_line1, row.address_line2].filter(Boolean).join(', ');
  const line2 = [row.suburb, row.state, row.postcode].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

// Fetch a user's saved addresses, default first then newest. Best-effort:
// returns [] on any error so a lookup failure never blocks checkout.
export async function fetchSavedAddresses(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
