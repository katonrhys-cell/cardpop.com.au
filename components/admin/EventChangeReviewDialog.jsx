import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { EVENT_CHANGE_LABELS, describeEventValue, isImageChangeField } from '@/utils/eventChangeRequests.js';
import { applyChangeRequest, dismissChangeRequest } from '@/lib/eventReviewApi.js';

// Admin → Event Management: an organiser's requested changes to their live
// event, field by field (current → requested). Apply writes them to the event
// in one DB transaction; Dismiss leaves the event alone. Either way the
// organiser is belled and emailed, with the note if one is written.

const Value = ({ field, value }) => {
  if (isImageChangeField(field) && value) {
    return <img src={toCdnUrl(value)} alt="" className="max-h-24 w-auto rounded-md border border-border object-contain" />;
  }
  return <span className="whitespace-pre-line break-words">{describeEventValue(field, value)}</span>;
};

const EventChangeReviewDialog = ({ event, request, onClose, onDecided }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => { if (request) setNote(''); }, [request]);

  const decide = async (kind) => {
    if (!request) return;
    setBusy(kind);
    try {
      if (kind === 'apply') {
        await applyChangeRequest(request.id, note);
        toast.success('Changes applied — the event page is updated and the organiser has been told.');
      } else {
        await dismissChangeRequest(request.id, note);
        toast.success('Changes dismissed — the organiser has been told.');
      }
      onDecided?.(request.event_id);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save the decision.');
    } finally {
      setBusy(null);
    }
  };

  const fields = Object.keys(request?.changes || {});

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Requested changes: {event?.title || 'Event'}</DialogTitle>
          <DialogDescription>
            The organiser asked to change {fields.length} {fields.length === 1 ? 'detail' : 'details'}. The live page
            stays as it is until you apply them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="divide-y divide-border rounded-xl border border-border">
            {fields.map((field) => (
              <div key={field} className="p-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  {EVENT_CHANGE_LABELS[field] || field}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:items-start">
                  <div className="text-muted-foreground line-through decoration-muted-foreground/40">
                    <Value field={field} value={event?.[field]} />
                  </div>
                  <ArrowRight className="hidden sm:block w-4 h-4 mt-0.5 text-muted-foreground" aria-hidden="true" />
                  <div className="font-medium text-foreground">
                    <Value field={field} value={request.changes[field]} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="change-review-note">Note to the organiser <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="change-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Say why if you dismiss the changes."
              disabled={Boolean(busy)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={Boolean(busy)}>Cancel</Button>
          <Button type="button" variant="outline" onClick={() => decide('dismiss')} disabled={Boolean(busy)}>
            {busy === 'dismiss' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Dismiss
          </Button>
          <Button type="button" onClick={() => decide('apply')} disabled={Boolean(busy)}>
            {busy === 'apply' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Apply changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventChangeReviewDialog;
