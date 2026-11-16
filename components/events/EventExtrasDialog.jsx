import React, { useEffect, useState } from 'react';
import { Check, Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';
import {
  EVENT_EXTRAS, EXTRAS_ENQUIRY_EMAIL, extraEligibility, formatAud, isEventExtra, todayInAustralia,
} from '@/utils/featuredPackages.js';

// Account → My Events → Promote: buy a promotion extra for one event — an
// Instagram story, an Instagram post or a full event review — and pay on
// Stripe. Extras are separate from Featured Placement and from membership:
// any organiser can buy one, and it never changes where the event sits on the
// site. The price shown is the table the server charges from
// (utils/featuredPackages.js); the server re-prices it, never trusting this.
const EventExtrasDialog = ({ event, onClose }) => {
  const [selected, setSelected] = useState(null);
  const [bought, setBought] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const today = todayInAustralia();

  // Which extras this event already has (the organiser can read their own
  // purchase rows). Best-effort: the server refuses a repeat either way.
  useEffect(() => {
    if (!event?.id) return undefined;
    let cancelled = false;
    setSelected(null);
    setBought([]);
    supabase
      .from('event_feature_purchases')
      .select('package')
      .eq('event_id', event.id)
      .eq('status', 'paid')
      .then(({ data }) => {
        if (!cancelled) setBought((data || []).map((r) => r.package).filter(isEventExtra));
      }, () => {});
    return () => { cancelled = true; };
  }, [event?.id]);

  const chosen = EVENT_EXTRAS.find((x) => x.key === selected) || null;

  const pay = async () => {
    if (!event || !chosen) return;
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const res = await apiServerClient.fetch(`/events/${event.id}/extra-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extra: chosen.key,
          successUrl: `${origin}/account/events?extra=success`,
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
            <Megaphone className="w-5 h-5 text-primary" aria-hidden="true" />
            Promote {event?.title || ''}
          </DialogTitle>
          <DialogDescription>
            Extras are promotion the CardPop team does for your show. They are separate from featured
            placement and from membership, so you can add one to any event. Prices include GST and are
            per event.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Promotion extra" className="grid gap-3">
          {EVENT_EXTRAS.map((extra) => {
            const eligibility = extraEligibility(event, extra.key, today, { bought });
            const isBought = bought.includes(extra.key);
            const active = selected === extra.key;
            return (
              <button
                key={extra.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!eligibility.ok}
                onClick={() => setSelected(extra.key)}
                className={`text-left rounded-2xl border-2 p-4 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-bold text-foreground">{extra.name}</span>
                  <span className="font-bold text-foreground">
                    {isBought ? <span className="text-sm font-semibold text-green-600">Booked</span> : formatAud(extra.priceAud * 100)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {extra.points.map((pt) => (
                    <li key={pt} className="flex gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" /> {pt}
                    </li>
                  ))}
                </ul>
                {extra.terms.length > 0 && (
                  <p className="mt-2 text-xs font-medium text-foreground">
                    Conditions: {extra.terms.join('. ')}.
                  </p>
                )}
                {!eligibility.ok && !isBought && (
                  <p className="mt-2 text-xs text-muted-foreground">{eligibility.reason}</p>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          We'll be in touch once you've paid to line up the details.
          Want something that isn't listed here? Email{' '}
          <a href={`mailto:${EXTRAS_ENQUIRY_EMAIL}`} className="text-primary hover:underline">{EXTRAS_ENQUIRY_EMAIL}</a>.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl">Cancel</Button>
          <Button onClick={pay} disabled={submitting || !chosen} className="rounded-xl font-bold">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
            {chosen ? `Pay ${formatAud(chosen.priceAud * 100)} for ${chosen.name}` : 'Choose an extra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventExtrasDialog;
