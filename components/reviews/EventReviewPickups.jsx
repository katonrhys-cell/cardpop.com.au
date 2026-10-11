import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { cleanPickups, formatAud } from '@/utils/eventReview.js';

const isInternal = (url) => typeof url === 'string' && url.startsWith('/');

const PickupLink = ({ url, children, className }) => {
  if (!url) return <span className={className}>{children}</span>;
  if (isInternal(url)) return <Link to={url} className={className}>{children}</Link>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
};

// The haul: what we picked up, what it cost, and (optionally) where to find it
// on CardPop — a marketplace listing, a price page or a shop product.
const EventReviewPickups = ({ pickups, title = 'Pickups from the show' }) => {
  const items = cleanPickups(pickups);
  if (items.length === 0) return null;
  const total = items.reduce((sum, p) => sum + (Number.isFinite(p.price_aud) ? p.price_aud : 0), 0);
  const priced = items.filter((p) => Number.isFinite(p.price_aud)).length;

  return (
    <section aria-labelledby="event-review-pickups" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-brand-red" aria-hidden="true" />
          <h2 id="event-review-pickups" className="font-heading text-xl font-bold text-foreground">{title}</h2>
        </div>
        {priced > 0 && (
          <p className="text-xs font-semibold text-muted-foreground">
            {items.length} {items.length === 1 ? 'pickup' : 'pickups'} · {formatAud(total)} spent
          </p>
        )}
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
        {items.map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            {p.image_url ? (
              <PickupLink url={p.url} className="shrink-0">
                <img
                  src={toCdnUrl(p.image_url)}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-16 rounded-lg object-cover bg-muted"
                />
              </PickupLink>
            ) : (
              <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground tabular-nums">
                #{i + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <PickupLink url={p.url} className={`text-sm font-semibold text-foreground leading-snug ${p.url ? 'hover:text-brand-red hover:underline' : ''}`}>
                  {p.name}
                  {p.url && !isInternal(p.url) && <ExternalLink className="inline w-3 h-3 ml-1 -mt-0.5 opacity-60" aria-hidden="true" />}
                </PickupLink>
                {Number.isFinite(p.price_aud) && (
                  <span className="shrink-0 rounded-md bg-brand-red/10 px-2 py-0.5 text-xs font-bold text-brand-red tabular-nums">
                    {formatAud(p.price_aud)}
                  </span>
                )}
              </div>
              {p.note && <p className="mt-1 text-xs text-muted-foreground leading-snug">{p.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default EventReviewPickups;
