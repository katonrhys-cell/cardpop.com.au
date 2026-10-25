import { useEffect, useState } from 'react';
import { fetchEventTicketOffer } from '@/lib/eventTicketOffers.js';

// Legacy static events carry non-UUID ids and never have an offer.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The live ticket offer for an event (offer line, whether a member code
 * exists, referral link), or null. A failed read leaves it null, so the page
 * falls back to the plain ticket link.
 */
export default function useEventTicketOffer(eventId, { enabled = true } = {}) {
  const [offer, setOffer] = useState(null);

  useEffect(() => {
    setOffer(null);
    if (!enabled || !UUID.test(String(eventId || ''))) return undefined;
    let cancelled = false;
    fetchEventTicketOffer(eventId)
      .then((row) => { if (!cancelled) setOffer(row); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [eventId, enabled]);

  return offer;
}
