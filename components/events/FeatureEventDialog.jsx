import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { OrganiserReachStrip, useOrganiserStats } from '@/components/events/OrganiserReach.jsx';
import {
  FEATURED_PACKAGES, EARLY_BIRD, BUNDLE, featuredQuote, featuredBundleQuote, formatAud, todayInAustralia,
} from '@/utils/featuredPackages.js';
import { formatEventDates } from '@/utils/eventPicker.js';

// Account → My Events → Feature: pick a Featured Placement package and pay on
// Stripe. The price shown is the same calculation the server charges
// (utils/featuredPackages.js); the server re-prices it, never trusting this.
//
// `featurable` is every event of the organiser's that can be featured right
// now; with BUNDLE.size or more, the dialog also offers the 3-event pack
// (`startInPack` opens on it), which features `event` plus two more in one
// checkout at the pack price.
const bySoonest = (a, b) => String(a.start_date || '').localeCompare(String(b.start_date || ''));

const FeatureEventDialog = ({ event, featurable = [], startInPack = false, onClose }) => {
  const [selected, setSelected] = useState('spotlight_instagram');
  const [submitting, setSubmitting] = useState(false);
  const [pack, setPack] = useState(false);
  const [packIds, setPackIds] = useState([]);
  const today = todayInAustralia();
  const reach = useOrganiserStats();

  // The pack's candidates: this event first, then the rest soonest first.
  const candidates = useMemo(() => {
    if (!event) return [];
    const others = featurable.filter((e) => e.id !== event.id).sort(bySoonest);
    return [event, ...others];
  }, [event, featurable]);
  const packAvailable = candidates.length >= BUNDLE.size;

  // Each time the dialog opens: single or pack as asked, with this event and
  // the next soonest ones ticked.
  useEffect(() => {
    if (!event) return;
    setPack(startInPack && packAvailable);
    setPackIds(candidates.slice(0, BUNDLE.size).map((e) => e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const packEvents = useMemo(
    () => candidates.filter((e) => packIds.includes(e.id)),
    [candidates, packIds],
  );
  const packReady = packEvents.length === BUNDLE.size;

  const quotes = useMemo(
    () => (event ? FEATURED_PACKAGES.map((p) => featuredQuote(p.key, event.start_date, today)) : []),
    [event, today],
  );
  // With fewer than three ticked, price the pack on the first candidates so
  // the cards still show a figure; Pay stays disabled until three are ticked.
  const packQuotes = useMemo(() => {
    if (!packAvailable) return [];
    const dates = (packReady ? packEvents : candidates.slice(0, BUNDLE.size)).map((e) => e.start_date);
    return FEATURED_PACKAGES.map((p) => featuredBundleQuote(p.key, dates, today));
  }, [packAvailable, packReady, packEvents, candidates, today]);
  const earlyBird = quotes[0]?.earlyBird;
  const bestSaving = packQuotes.length ? Math.max(...packQuotes.map((q) => q.savingCents)) : 0;
  const shown = pack ? packQuotes : quotes;
  const selectedPrice = shown.find((q) => q.pkg.key === selected)?.priceCents ?? 0;

  const togglePackEvent = (id) => {
    setPackIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= BUNDLE.size) return ids;
      return [...ids, id];
    });
  };

  const pay = async () => {
    if (!event || (pack && !packReady)) return;
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const urls = {
        successUrl: `${origin}/account/events?featured=success`,
        cancelUrl: `${origin}/account/events`,
      };
      const res = await apiServerClient.fetch(
        pack ? '/events/feature-bundle-checkout' : `/events/${event.id}/feature-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pack
            ? { package: selected, eventIds: packEvents.map((e) => e.id), ...urls }
            : { package: selected, ...urls }),
        },
      );
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
            <Star className="w-5 h-5 text-primary fill-current" aria-hidden="true" />
            {pack ? `Feature ${BUNDLE.size} events` : `Feature ${event?.title || ''}`}
          </DialogTitle>
          <DialogDescription>
            Put your show at the top of the CardPop events calendar. Prices include GST
            {pack ? ` and cover all ${BUNDLE.size} events.` : ' and are per event.'}
            {pack
              ? ` Early bird (${EARLY_BIRD.pct}% off) still applies to any of them ${EARLY_BIRD.minDays / 7}+ weeks away.`
              : earlyBird
              ? ` You're booking ${EARLY_BIRD.minDays / 7}+ weeks ahead, so the early bird price applies: ${EARLY_BIRD.pct}% off.`
              : ` Book ${EARLY_BIRD.minDays / 7}+ weeks before a show for ${EARLY_BIRD.pct}% off.`}
          </DialogDescription>
        </DialogHeader>

        <OrganiserReachStrip stats={reach} />

        {packAvailable && (
          <div role="radiogroup" aria-label="Feature one event or a pack" className="grid grid-cols-2 gap-2">
            {[
              { key: false, label: 'This event', hint: 'One event' },
              { key: true, label: `${BUNDLE.size}-event pack`, hint: bestSaving > 0 ? `Save up to ${formatAud(bestSaving)}` : `${BUNDLE.size} events, one payment` },
            ].map((opt) => (
              <button
                key={String(opt.key)}
                type="button"
                role="radio"
                aria-checked={pack === opt.key}
                onClick={() => setPack(opt.key)}
                className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${pack === opt.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <span className="block text-sm font-bold text-foreground">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.hint}</span>
              </button>
            ))}
          </div>
        )}

        {pack && (
          <fieldset className="rounded-2xl border border-border p-3">
            <legend className="px-1 text-sm font-semibold text-foreground">
              Choose {BUNDLE.size} events <span className="font-normal text-muted-foreground">({packEvents.length} of {BUNDLE.size})</span>
            </legend>
            <ul className="space-y-1">
              {candidates.map((e) => {
                const checked = packIds.includes(e.id);
                const full = !checked && packIds.length >= BUNDLE.size;
                return (
                  <li key={e.id}>
                    <label className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${full ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={checked}
                        disabled={full}
                        onChange={() => togglePackEvent(e.id)}
                      />
                      <span className="flex-1 font-medium text-foreground">{e.title}</span>
                      {e.start_date && <span className="text-xs text-muted-foreground">{formatEventDates(e)}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        <div role="radiogroup" aria-label="Featuring package" className="grid gap-3">
          {shown.map((q) => {
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
                    {pack
                      ? <span className="mr-2 text-sm font-normal text-muted-foreground line-through">{formatAud(q.listCents)}</span>
                      : q.earlyBird && <span className="mr-2 text-sm font-normal text-muted-foreground line-through">{formatAud(q.baseCents)}</span>}
                    {formatAud(q.priceCents)}
                    {pack && <span className="ml-1 text-xs font-normal text-muted-foreground">for {BUNDLE.size}</span>}
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
          {(pack ? packEvents.some((e) => e.status === 'pending_review') : event?.status === 'pending_review')
            && ' An event still being reviewed appears on the calendar, featured, once it\'s approved.'}
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-xl">Cancel</Button>
          <Button onClick={pay} disabled={submitting || (pack && !packReady)} className="rounded-xl font-bold">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
            {pack && !packReady
              ? `Choose ${BUNDLE.size - packEvents.length} more`
              : `Pay ${formatAud(selectedPrice)} and feature${pack ? ` ${BUNDLE.size} events` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureEventDialog;
