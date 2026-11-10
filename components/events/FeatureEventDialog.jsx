import React, { useMemo, useState } from 'react';
import { Check, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiServerClient } from '@/lib/apiServerClient.js';
import {
  FEATURED_PACKAGES, EARLY_BIRD, featuredQuote, formatAud, todayInAustralia,
} from '@/utils/featuredPackages.js';

// Account → My Events → Feature: pick a Featured Placement package and pay on
// Stripe. The price shown is the same calculation the server charges
// (utils/featuredPackages.js); the server re-prices it, never trusting this.
const FeatureEventDialog = ({ event, onClose }) => {
  const [selected, setSelected] = useState('spotlight_instagram');
  const [submitting, setSubmitting] = useState(false);
  const today = todayInAustralia();

  const quotes = useMemo(
    () => (event ? FEATURED_PACKAGES.map((p) => featuredQuote(p.key, event.start_date, today)) : []),
    [event, today],
  );
  const earlyBird = quotes[0]?.earlyBird;

  const pay = async () => {
    if (!event) return;
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const res = await apiServerClient.fetch(`/events/${event.id}/feature-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: selected,
          successUrl: `${origin}/account/events?featured=success`,
          cancelUrl: `${origin}/account/events`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start checkout.');
      if (!data?.url) throw new Error('No checkout link was returned.');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || 'Could not start checkout.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary fill-current" aria-hidden="true" /> Feature {event?.title}
          </DialogTitle>
          <DialogDescription>
            Put your show at the top of the CardPop events calendar. Prices include GST and are per event.
            {earlyBird
              ? ` You're booking ${EARLY_BIRD.minDays / 7}+ weeks ahead, so the early bird price applies: ${EARLY_BIRD.pct}% off.`
              : ` Book ${EARLY_BIRD.minDays / 7}+ weeks before a show for ${EARLY_BIRD.pct}% off.`}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Featuring package" className="grid gap-3">
          {quotes.map((q) => {
            const active = selected === q.pkg.key;
            return (
              <button
                key={q.pkg.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(q.pkg.key)}
                className={`text-left rounded-2xl border-2 p-4 transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-bold text-foreground">
                    {q.pkg.name}
                    {q.pkg.highlight && <span className="ml-2 text-xs font-semibold text-primary">Most popular</span>}
                  </span>
                  <span className="font-bold text-foreground">
                    {q.earlyBird && <span className="mr-2 text-sm font-normal text-muted-foreground line-through">{formatAud(q.baseCents)}</span>}
                    {formatAud(q.priceCents)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {q.pkg.points.map((pt) => (
                    <li key={pt} className="flex gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" /> {pt}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Featuring switches on as soon as payment goes through and lasts until your show ends.
          {event?.status === 'pending_review' && ' Your event is still being reviewed. It appears on the calendar, featured, once it\'s approved.'}
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl">Cancel</Button>
          <Button onClick={pay} disabled={submitting} className="rounded-xl font-bold">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
            Pay {formatAud(quotes.find((q) => q.pkg.key === selected)?.priceCents ?? 0)} and feature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureEventDialog;
