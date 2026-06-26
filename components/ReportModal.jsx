import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';

// User-facing "report this listing / seller" flow. Posts to the auth-gated,
// rate-limited /reports backend endpoint (the React layer is not the security
// boundary — the server validates and de-dupes). Drop it anywhere with a
// target type + id; pass `trigger` to use a custom button, or it renders a
// default outline "Report" button.

const REASONS = [
  { value: 'counterfeit', label: 'Counterfeit / not authentic' },
  { value: 'scam', label: 'Scam or fraudulent seller' },
  { value: 'misrepresentation', label: 'Condition / grade not as described' },
  { value: 'prohibited_item', label: 'Prohibited or banned item' },
  { value: 'inappropriate', label: 'Offensive or inappropriate' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

const LABELS = {
  listing: 'listing', user: 'seller', review: 'review', message: 'message', event: 'event',
};

const ReportModal = ({ targetType, targetId, targetLabel, trigger }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const noun = targetLabel || LABELS[targetType] || 'item';

  const handleOpenChange = (next) => {
    if (next && !isAuthenticated) {
      toast.error('Please sign in to report content.');
      navigate('/login', { state: { from: { pathname: window.location.pathname } } });
      return;
    }
    setOpen(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please choose a reason.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiServerClient.fetch('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: String(targetId),
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        toast.error('Please sign in to report content.');
        navigate('/login');
        return;
      }
      if (res.status === 409) {
        toast.info("You've already reported this — our team is reviewing it.");
        setOpen(false);
        return;
      }
      if (res.status === 429) {
        toast.error('You have submitted too many reports recently. Please try again later.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit report');
      }

      toast.success('Thanks — our team will review this shortly.');
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (err) {
      toast.error(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
            <Flag className="w-4 h-4" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Report this {noun}</DialogTitle>
            <DialogDescription>
              Help keep CardPop safe. Reports are confidential and reviewed by our team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="report-reason" aria-label="Reason for reporting">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-details">Details <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="report-details"
                placeholder="Add anything that helps us understand the problem…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !reason}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : 'Submit report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
