import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rejectEvent } from '@/lib/eventReviewApi.js';

// Admin → Event Management: reject a member's submission with a reason. The
// organiser sees the reason in My Events, in their bell and by email, and can
// edit and resubmit.
const EventRejectDialog = ({ event, onClose, onRejected }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (event) setReason(''); }, [event]);

  const submit = async (e) => {
    e.preventDefault();
    if (!event) return;
    setSaving(true);
    try {
      await rejectEvent(event.id, reason);
      toast.success('Event rejected — the organiser has been told why.');
      onRejected?.(event.id, reason.trim() || null);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to reject the event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reject “{event?.title}”</DialogTitle>
            <DialogDescription>
              The organiser can edit the event and resubmit it. Tell them what to fix.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="e.g. This event is already listed by its organiser, or: please add the venue address."
              disabled={saving}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventRejectDialog;
