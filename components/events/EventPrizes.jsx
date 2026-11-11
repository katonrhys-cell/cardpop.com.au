import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toCdnUrl } from '@/utils/imageUrl.js';

// The event page's prize table (events.event_prizes + events.prize_pool,
// normalised by cleanEventPrizes / cleanPrizePool): the headline pool, then
// one row per placing with its payout and photos of the cards that can be
// won. Photos are card-shaped tiles that open full size. Shown above the
// event videos. Renders nothing without a prize or a pool.
const EventPrizes = ({ prizes = [], prizePool = '', eventName = '', headingId = 'event-prizes' }) => {
  const [open, setOpen] = useState(null); // { url, alt } | null
  if (prizes.length === 0 && !prizePool) return null;
  const name = eventName || 'the event';

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">Prizes</h2>
      </div>

      {prizePool && (
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold">Total prize pool:</span> {prizePool}
        </p>
      )}

      {prizes.length > 0 && (
        <ol className="space-y-3 list-none p-0 m-0">
          {prizes.map((prize, i) => (
            <li key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {prize.place && <h3 className="font-heading text-base font-bold text-foreground">{prize.place}</h3>}
                {prize.reward && <p className="text-sm text-muted-foreground">{prize.reward}</p>}
              </div>
              {prize.images.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3 list-none p-0 m-0">
                  {prize.images.map((url, j) => {
                    const alt = `${prize.place ? `${prize.place} prize` : 'Prize'} card ${j + 1} of ${prize.images.length} — ${name}`;
                    return (
                      <li key={`${url}-${j}`} className="w-24 sm:w-28">
                        <button
                          type="button"
                          onClick={() => setOpen({ url, alt })}
                          className="group block w-full overflow-hidden rounded-lg bg-muted aspect-[5/7] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
                          aria-label={`View ${alt}`}
                        >
                          <img
                            src={toCdnUrl(url)}
                            alt={alt}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl w-[96vw] p-0 bg-black border-none overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">{open?.alt || 'Prize photo'}</DialogTitle>
          {open && (
            <img src={toCdnUrl(open.url)} alt={open.alt} className="block w-full max-h-[85vh] object-contain bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default EventPrizes;
