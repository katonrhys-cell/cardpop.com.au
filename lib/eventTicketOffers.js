import { supabase } from '@/lib/supabaseClient.js';

// Event ticket offers — the organiser's member discount code and CardPop's
// referral link for an event (supabase/migrations/20261025075600_event_ticket_offers.sql).
// Tickets are sold on the organiser's site; CardPop only shows the code to
// signed-in members, routes "Get Tickets" through the referral link and
// counts clicks/reveals. See docs/event-ticket-offers.md.

const HTTP_URL = /^https?:\/\/\S+$/i;

export const isHttpUrl = (value) => typeof value === 'string' && HTTP_URL.test(value.trim());

/**
 * Where "Get Tickets" goes: the referral link while an offer carries one,
 * else the event's own ticket page, else its website. Null = no ticket link.
 */
export function ticketDestination(event, offer) {
  if (offer?.referralUrl && isHttpUrl(offer.referralUrl)) return offer.referralUrl;
  return event?.ticket_url || event?.website_url || event?.ticketLink || null;
}

/** The public teaser for an event, or null when it has no live offer. */
export async function fetchEventTicketOffer(eventId) {
  if (!eventId) return null;
  const { data, error } = await supabase.rpc('get_event_ticket_offer', { p_event_id: eventId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    offerText: row.offer_text || null,
    hasCode: Boolean(row.has_code),
    referralUrl: row.referral_url || null,
  };
}

/** The member code (signed-in callers only). Null when there's none to show. */
export async function revealEventTicketCode(eventId) {
  const { data, error } = await supabase.rpc('reveal_event_ticket_code', { p_event_id: eventId });
  if (error) throw error;
  return data || null;
}

/** Count a "Get Tickets" click. Fire-and-forget — never blocks the link. */
export function recordEventTicketClick(eventId) {
  if (!eventId) return;
  supabase.rpc('record_event_ticket_click', { p_event_id: eventId }).then(() => {}, () => {});
}

// ── Admin ────────────────────────────────────────────────────────────────

export const EMPTY_OFFER_FORM = { offer_text: '', discount_code: '', referral_url: '', is_active: true };

/** The admin's row for an event (form shape + read-only stats), or null. */
export async function loadAdminTicketOffer(eventId) {
  const { data, error } = await supabase
    .from('event_ticket_offers')
    .select('offer_text, discount_code, referral_url, is_active, ticket_clicks, code_reveals, last_click_at, last_reveal_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** True when the form holds nothing worth saving. */
export const isOfferFormBlank = (form) =>
  !form.offer_text.trim() && !form.discount_code.trim() && !form.referral_url.trim();

/** A message for the first problem in the form, or null when it's valid. */
export function validateOfferForm(form) {
  if (form.offer_text.trim().length > 120) return 'The offer line must be 120 characters or fewer.';
  if (form.discount_code.trim().length > 60) return 'The ticket code must be 60 characters or fewer.';
  if (form.referral_url.trim() && !isHttpUrl(form.referral_url)) return 'The referral link must start with https://';
  return null;
}

/**
 * Save the offer with the event. A blank form removes an existing row only
 * when it has no history; with clicks or reveals it's switched off instead so
 * the numbers survive.
 */
export async function saveAdminTicketOffer(eventId, form, existing) {
  if (isOfferFormBlank(form)) {
    if (!existing) return;
    const hasHistory = (existing.ticket_clicks || 0) + (existing.code_reveals || 0) > 0;
    const { error } = hasHistory
      ? await supabase.from('event_ticket_offers')
          .update({ offer_text: null, discount_code: null, referral_url: null, is_active: false })
          .eq('event_id', eventId)
      : await supabase.from('event_ticket_offers').delete().eq('event_id', eventId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('event_ticket_offers').upsert({
    event_id: eventId,
    offer_text: form.offer_text.trim() || null,
    discount_code: form.discount_code.trim() || null,
    referral_url: form.referral_url.trim() || null,
    is_active: form.is_active,
  }, { onConflict: 'event_id' });
  if (error) throw error;
}
