import React from 'react';
import { formatEntryFee } from '@/lib/eventSeo.js';
import { ticketPriceLines } from '@/utils/eventTicketPrices.js';

// An event's entry price (GA / presale, or "Free entry") followed by its extra
// ticket prices — Child, VIP, GA early & late access, group
// (utils/eventTicketPrices.js). Shared by the event page and the event modal.
const EventEntryPrices = ({ event, className = 'text-muted-foreground leading-snug', valueClassName = 'font-semibold text-foreground' }) => {
  const lines = event.is_free ? [] : ticketPriceLines(event.ticket_prices);
  // "See organiser for pricing" would contradict a list of prices.
  const showFee = !lines.length || Number(event.entry_fee_aud) > 0 || Number(event.presale_fee_aud) > 0;
  return (
    <>
      {showFee && <p className={className}>{formatEntryFee(event)}</p>}
      {lines.length > 0 && (
        <dl className={`mt-1 space-y-0.5 ${className}`} aria-label="Ticket prices">
          {lines.map(({ label, price }) => (
            <div key={label} className="flex justify-between gap-4">
              <dt>{label}</dt>
              <dd className={`${valueClassName} tabular-nums`}>{price}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
};

export default EventEntryPrices;
