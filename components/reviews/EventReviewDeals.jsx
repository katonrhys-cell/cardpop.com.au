import React from 'react';
import { Link } from 'react-router-dom';
import { Tag, ExternalLink } from 'lucide-react';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { cleanDeals, dealSavingPct, formatAud } from '@/utils/eventReview.js';

const isInternal = (url) => typeof url === 'string' && url.startsWith('/');

const DealLink = ({ url, children, className }) => {
  if (!url) return <span className={className}>{children}</span>;
  if (isInternal(url)) return <Link to={url} className={className}>{children}</Link>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
};

// Deals of the day: the bargains vendors were running on the floor — the
// product, the table that had it, the price and what it normally goes for.
const EventReviewDeals = ({ deals, title = 'Deals of the day' }) => {
  const items = cleanDeals(deals);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="event-review-deals" className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id="event-review-deals" className="font-heading text-xl font-bold text-foreground">{title}</h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
        {items.map((d, i) => {
          const pct = dealSavingPct(d);
          return (
            <li key={`${d.title}-${i}`} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
              {d.image_url && (
                <DealLink url={d.url} className="shrink-0">
                  <img src={toCdnUrl(d.image_url)} alt={d.title} loading="lazy" decoding="async" className="h-20 w-16 rounded-lg object-cover bg-muted" />
                </DealLink>
              )}
              <div className="min-w-0 flex-1">
                <DealLink url={d.url} className={`text-sm font-semibold text-foreground leading-snug ${d.url ? 'hover:text-brand-red hover:underline' : ''}`}>
                  {d.title}
                  {d.url && !isInternal(d.url) && <ExternalLink className="inline w-3 h-3 ml-1 -mt-0.5 opacity-60" aria-hidden="true" />}
                </DealLink>
                {d.vendor && <p className="mt-0.5 text-xs text-muted-foreground">{d.vendor}</p>}
                {(d.price_aud != null || d.was_price_aud != null) && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {d.price_aud != null && (
                      <span className="rounded-md bg-brand-red/10 px-2 py-0.5 text-xs font-bold text-brand-red tabular-nums">{formatAud(d.price_aud)}</span>
                    )}
                    {d.was_price_aud != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        <s>{formatAud(d.was_price_aud)}</s>{pct != null && <span className="ml-1 font-semibold">{pct}% off</span>}
                      </span>
                    )}
                  </p>
                )}
                {d.note && <p className="mt-1 text-xs text-muted-foreground leading-snug">{d.note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default EventReviewDeals;
