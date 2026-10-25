# Event ticket offers (member code + referral link)

Each event can carry a **member ticket offer**: the organiser's ticket
discount code, shown to signed-in CardPop members, and the organiser's
**referral / tracking link**, which "Get Tickets" goes through so the
organiser can credit CardPop for the sale.

Tickets are sold on the organiser's site (Humanitix, Eventbrite, their own
shop). CardPop never applies the discount or sees the sale — it shows the
code, routes the click and counts both.

## Setting one up

Admin → Events → edit the event → **Member Offer** tab:

| Field | Meaning |
|---|---|
| **Offer line** | Public teaser, e.g. "15% off GA tickets for CardPop members" (120 chars). |
| **Ticket discount code** | The code the organiser gave you. Visible to signed-in members only. |
| **Referral / tracking link** | The organiser's or ticket platform's link that credits CardPop (e.g. `…?ref=cardpop`). While set, "Get Tickets" opens this instead of the Tickets URL. Must start with `http(s)://`. |
| **Offer live** | Switch off to hide everything without losing the code or the counts. |

The offer is saved with the event. Clearing every field deletes an unused
offer; one that already has clicks or reveals is switched off instead so its
numbers are kept.

## What visitors see

On the event page and the calendar's event dialog, above "Get Tickets":

- **Signed-in member** — "Reveal ticket code" → the code with a Copy button.
- **Signed out** — the offer line and "Sign in to reveal the code" (returns to
  the event after sign-in). The code is never sent to their browser.

An offer only shows while the event is **approved** and hasn't ended (last
day, Australian time). Past, completed, pending and cancelled events show
nothing.

## Tracking

Admin → Events shows "Member offer · N clicks · N reveals" under each event
with an offer; the Member Offer tab shows the counts with the last time each
happened.

- **Ticket clicks** — "Get Tickets" clicks (left or middle click) while an
  offer is live, whether or not it has a referral link.
- **Code reveals** — "Reveal ticket code" presses by signed-in members.

These are raw counts (not de-duplicated, and anyone can click). Ticket
*sales* happen on the organiser's site — get those from the organiser's
referral report.

## How it's built

- `supabase/migrations/20261025075600_event_ticket_offers.sql` —
  `event_ticket_offers` (1:1 with `events`). `events` is publicly readable,
  so the code lives in this table, which has **no public SELECT**; admins
  manage it through RLS. The page reads it through security-definer functions:
  `get_event_ticket_offer()` (teaser, anon + signed in — never the code),
  `reveal_event_ticket_code()` (signed in only, counts a reveal) and
  `record_event_ticket_click()`. A trigger stops a form save from resetting
  the counters. Test: `tests/db/run-event-ticket-offer-migration.sh`.
- `lib/eventTicketOffers.js` — reads, admin save, and `ticketDestination()`
  (referral link → ticket URL → website).
- `hooks/useEventTicketOffer.js`, `components/events/EventTicketOffer.jsx`
  (member box), `components/admin/EventTicketOfferPanel.jsx` (admin tab).
- Event JSON-LD / prerender keep the organiser's own `ticket_url`.
