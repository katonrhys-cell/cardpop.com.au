import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Loader2, UserPlus, X } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

// Admin → Players → requests. A member couldn't find an athlete in the card
// form's Player picker. Approving confirms they're real and creates an
// UNPUBLISHED draft player (opened for editing by `onApproved`); declining
// needs a reason the member sees. docs/players.md → Player requests

const callApi = async (path, init) => {
  const res = await apiServerClient.fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'Request failed');
  return body;
};

const RequestRow = ({ req, onDecided }) => {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (action) => {
    setBusy(true);
    try {
      const body = await callApi(`/player-requests/admin/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || null }),
      });
      toast.success(action === 'approve' ? `${req.name} confirmed — draft created, finish and publish it.` : 'Declined — they’ve been told why.');
      onDecided(action === 'approve' ? body.player : null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{req.name}</h3>
            <Badge variant="outline">{req.sport}</Badge>
            {req.team && <span className="text-xs text-muted-foreground">{req.team}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            Asked by {req.applicant?.name || req.applicant?.username || 'a member'}
            {req.applicant?.email ? ` (${req.applicant.email})` : ''} · {new Date(req.created_at).toLocaleDateString('en-AU')}
          </p>
          {req.reference_url && (
            <a href={req.reference_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              Check them here <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {req.note && <p className="text-sm text-muted-foreground">“{req.note}”</p>}
        </div>
        {!rejecting && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide('approve')} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Confirm &amp; create draft
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
              <X className="mr-1.5 h-4 w-4" /> Decline
            </Button>
          </div>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 space-y-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason the member will see (required)" aria-label="Reason for declining" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => decide('reject')} disabled={busy || !note.trim()}>Decline request</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const PlayerRequestsPanel = ({ onApproved }) => {
  const [requests, setRequests] = useState(null);

  const load = useCallback(async () => {
    try {
      const body = await callApi('/player-requests/admin');
      setRequests((body.requests || []).filter((r) => r.status === 'pending'));
    } catch (err) {
      setRequests([]);
      toast.error(`Could not load player requests: ${err.message}`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!requests?.length) return null;

  return (
    <section className="mb-6 space-y-3" aria-label="Player requests">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <UserPlus className="h-5 w-5 text-primary" /> Player requests
        <Badge>{requests.length}</Badge>
      </h2>
      {requests.map((r) => (
        <RequestRow key={r.id} req={r} onDecided={(player) => { load(); if (player) onApproved?.(player); }} />
      ))}
    </section>
  );
};

export default PlayerRequestsPanel;
