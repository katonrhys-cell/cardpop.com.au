import React, { useEffect, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatEventDates, formatEventPlace } from '@/utils/eventPicker.js';

// "Feature Now" step 1: which of the organiser's events to feature. Only
// events that can be featured right now are listed (AccountEvents passes the
// featureEligibility() list, soonest first). Continue hands the pick to
// FeatureEventDialog (package + Stripe); "Submit a new event" is the way out
// for someone who wants to feature a show they haven't listed yet.
const FeatureEventChooser = ({ events = [], open, onChoose, onSubmitNew, onClose }) => {
  const [pickedId, setPickedId] = useState(null);

  // Each time it opens, tick the soonest show — the usual one to promote.
  useEffect(() => {
    if (open) setPickedId(events[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const picked = events.find((e) => e.id === pickedId) || null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary fill-current" aria-hidden="true" />
            Which event do you want to feature?
          </DialogTitle>
          <DialogDescription>
            Pick one of your events. You choose the package and pay on the next step.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Event to feature" className="grid gap-2">
          {events.map((e) => {
            const active = e.id === pickedId;
            const place = formatEventPlace(e);
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPickedId(e.id)}
                className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <span className="block font-bold text-foreground break-words">{e.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {[formatEventDates(e), place].filter(Boolean).join(' · ')}
                  {e.status === 'pending_review' ? ' · Pending review' : ''}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSubmitNew}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Feature a show that isn&rsquo;t listed yet
        </button>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={() => picked && onChoose(picked)} disabled={!picked} className="rounded-xl font-bold">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureEventChooser;
