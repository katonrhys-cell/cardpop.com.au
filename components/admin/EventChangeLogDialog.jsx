import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { changeRows, describeEventValue, isImageChangeField } from '@/utils/eventChangeLog.js';
import { loadEventChangeLog, markEventChangesReviewed } from '@/lib/eventReviewApi.js';
import { eventPath } from '@/lib/eventSeo.js';

// Admin → Event Management: what the organiser changed on their live event,
// save by save — each field before → after. Organiser edits go live
// immediately; this is where admins see them (the bell and email link here)
// and mark them reviewed. To undo a change, edit the event.

const Value = ({ field, value }) => {
  if (isImageChangeField(field) && value) {
    return <img src={toCdnUrl(value)} alt="" className="max-h-24 w-auto rounded-md border border-border object-contain" />;
  }
  return <span className="whitespace-pre-line break-words">{describeEventValue(field, value)}</span>;
};

const EventChangeLogDialog = ({ event, onClose, onReviewed }) => {
  const [entries, setEntries] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event?.id) { setEntries(null); return undefined; }
    let cancelled = false;
    setEntries(null);
    loadEventChangeLog(event.id)
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch(() => { if (!cancelled) { setEntries([]); toast.error("Couldn't load this event's changes."); } });
    return () => { cancelled = true; };
  }, [event?.id]);

  const unreviewed = (entries || []).filter((e) => !e.reviewed_at).length;

  const markReviewed = async () => {
    setSaving(true);
    try {
      await markEventChangesReviewed(event.id);
      toast.success('Marked as reviewed.');
      onReviewed?.(event.id);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to mark the changes reviewed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Organiser edits: {event?.title || 'Event'}</DialogTitle>
          <DialogDescription>
            These changes are already live. Check them, edit the event if anything needs undoing, then mark them reviewed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
          {entries === null ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No organiser edits recorded for this event.</p>
          ) : entries.map((entry) => (
            <section key={entry.id} className="rounded-xl border border-border">
              <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30 text-xs">
                <span className="font-semibold text-foreground">
                  {entry.changed_by_name || 'The organiser'} · {format(new Date(entry.created_at), 'd MMM yyyy, h:mm a')}
                </span>
                {entry.reviewed_at
                  ? <Badge variant="outline" className="text-xs">Reviewed</Badge>
                  : <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400">New</Badge>}
              </header>
              <div className="divide-y divide-border">
                {changeRows(entry.changes).map(({ field, label, from, to }) => (
                  <div key={field} className="p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:items-start">
                      <div className="text-muted-foreground line-through decoration-muted-foreground/40">
                        <Value field={field} value={from} />
                      </div>
                      <ArrowRight className="hidden sm:block w-4 h-4 mt-0.5 text-muted-foreground" aria-hidden="true" />
                      <div className="font-medium text-foreground">
                        <Value field={field} value={to} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {event && (
            <Button asChild variant="ghost" className="sm:mr-auto">
              <Link to={eventPath(event)} target="_blank" rel="noopener">
                <ExternalLink className="w-4 h-4 mr-2" /> View live page
              </Link>
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Close</Button>
            <Button type="button" onClick={markReviewed} disabled={saving || unreviewed === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark {unreviewed > 0 ? unreviewed : ''} as reviewed
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventChangeLogDialog;
