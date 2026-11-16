import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ExternalLink, Loader2, UserCheck, X } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { storePath } from '@/utils/storePage.js';

// Admin → Store Directory: members who applied to own a shop's page. Approve
// makes them the shop's owner (they can then edit the page themselves);
// decline needs a reason, which the member is shown. The organiser twin is
// pages/admin/OrganiserRequestsAdminPage.jsx. docs/store-pages.md → "Shop owners"

const RequestRow = ({ request, onDecided }) => {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = request.status === 'pending';

  const decide = async (action) => {
    setBusy(true);
    try {
      const res = await apiServerClient.fetch(`/store-owner-requests/admin/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: action === 'reject' ? note.trim() : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'Could not record the decision');
      toast.success(action === 'approve' ? `${request.applicant?.name || 'Member'} now manages ${request.store?.name || 'the shop'}` : 'Request declined');
      onDecided();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const who = request.applicant?.name || request.applicant?.username || 'Member';
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{who} → {request.store?.name || 'Shop removed'}</h3>
            <Badge variant={request.status === 'approved' ? 'default' : pending ? 'secondary' : 'destructive'}>{request.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[request.applicant?.email, request.role_title, new Date(request.created_at).toLocaleDateString('en-AU')].filter(Boolean).join(' · ')}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {request.store && storePath(request.store) && (
              <Link to={storePath(request.store)} className="text-primary hover:underline">View shop page</Link>
            )}
            {request.website_url && (
              <a href={request.website_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                {request.website_url} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <Link to={`/admin/users/${request.user_id}`} className="text-primary hover:underline">Member account</Link>
          </div>
          {request.message && <p className="text-sm mt-1 whitespace-pre-line">{request.message}</p>}
          {request.decision_note && <p className="text-sm text-muted-foreground">Reason given: {request.decision_note}</p>}
        </div>
        {pending && !declining && (
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" onClick={() => decide('approve')} disabled={busy || !request.store}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Confirm as owner
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDeclining(true)} disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Decline
            </Button>
          </div>
        )}
      </div>
      {pending && declining && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Why can't this be confirmed? The member sees this."
            aria-label="Reason for declining"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => decide('reject')} disabled={busy || !note.trim()}>Decline request</Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclining(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const StoreOwnerRequests = ({ onChanged }) => {
  const [requests, setRequests] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch('/store-owner-requests/admin');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRequests((await res.json()).requests || []);
    } catch (err) {
      setRequests([]);
      toast.error(`Failed to load shop owner requests: ${err.message}`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (requests === null) return null;
  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending').slice(0, 10);
  const onDecided = () => { load(); onChanged?.(); };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <UserCheck className="w-5 h-5" /> Shop owner requests ({pending.length})
      </h2>
      {pending.length === 0 && (
        <p className="text-sm text-muted-foreground">No one is waiting to be confirmed as a shop’s owner.</p>
      )}
      {pending.map((r) => <RequestRow key={r.id} request={r} onDecided={onDecided} />)}
      {decided.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Recently decided ({decided.length})</summary>
          <div className="space-y-3 mt-3">
            {decided.map((r) => <RequestRow key={r.id} request={r} onDecided={onDecided} />)}
          </div>
        </details>
      )}
    </section>
  );
};

export default StoreOwnerRequests;
