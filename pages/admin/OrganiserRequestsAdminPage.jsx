import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Check, ExternalLink, Loader2, Megaphone, X } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { organiserKey } from '@/utils/eventOrganisers.js';

// Admin → Organiser Requests. A member says they run events; the admin checks
// them (website, email, message), then approves — linking an existing directory
// entry or creating one — or declines with a reason. Approval makes them the
// owner of that organiser page. docs/event-organiser-access.md

const STATUS_VARIANT = { pending: 'secondary', approved: 'default', rejected: 'destructive' };

const callApi = async (path, init) => {
  const res = await apiServerClient.fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'Request failed');
  return body;
};

const RequestCard = ({ req, organisers, onDecided }) => {
  const [mode, setMode] = useState(null); // null | 'reject'
  const [note, setNote] = useState('');
  const [organiserId, setOrganiserId] = useState(req.organiser_id || '');
  const [busy, setBusy] = useState(false);

  // Unowned directory entries first; one whose name matches the request is pre-suggested.
  const candidates = useMemo(() => organisers.filter((o) => !o.owner_id), [organisers]);
  const suggested = useMemo(
    () => candidates.find((o) => organiserKey(o.name) === organiserKey(req.organiser_name)),
    [candidates, req.organiser_name],
  );
  const target = organiserId || suggested?.id || '';

  const decide = async (action) => {
    setBusy(true);
    try {
      await callApi(`/organiser-requests/admin/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || null, organiserId: action === 'approve' ? (target || null) : null }),
      });
      toast.success(action === 'approve' ? 'Approved — they can now edit their page.' : 'Declined — they’ve been told why.');
      onDecided();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{req.organiser_name}</h3>
            <Badge variant={STATUS_VARIANT[req.status]}>{req.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {req.applicant?.name || req.applicant?.username || 'Member'}
            {req.applicant?.email && <> · <a className="text-primary hover:underline" href={`mailto:${req.applicant.email}`}>{req.applicant.email}</a></>}
            {' · '}{new Date(req.created_at).toLocaleDateString('en-AU')}
          </p>
          {req.website_url && (
            <a href={req.website_url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
              {req.website_url} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
          {req.message && <p className="text-sm mt-2 whitespace-pre-line">{req.message}</p>}
          {req.status === 'rejected' && req.decision_note && (
            <p className="text-sm text-destructive mt-2">Reason given: {req.decision_note}</p>
          )}
        </div>
      </div>

      {req.status === 'pending' && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {mode === 'reject' ? (
            <>
              <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason shown to the member (required)" disabled={busy} aria-label="Reason for declining" />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={busy || !note.trim()} onClick={() => decide('reject')}>
                  {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />} Decline &amp; notify
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Back</Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor={`link-${req.id}`} className="text-xs font-bold uppercase tracking-wide">Organiser page</label>
                <select
                  id={`link-${req.id}`}
                  value={target}
                  onChange={(e) => setOrganiserId(e.target.value)}
                  disabled={busy}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Create a new page called “{req.organiser_name}”</option>
                  {candidates.map((o) => <option key={o.id} value={o.id}>Link existing: {o.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                  {target ? 'They’ll become the owner of this existing page.' : 'No unowned page with that name exists, so one will be created.'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => decide('approve')}>
                  {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4 mr-1" aria-hidden="true" />} Confirm as organiser
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('reject')}>
                  <X className="w-4 h-4 mr-1" aria-hidden="true" /> Decline
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const FILTERS = ['pending', 'approved', 'rejected', 'all'];

const OrganiserRequestsAdminPage = () => {
  const [data, setData] = useState({ requests: [], organisers: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await callApi('/organiser-requests/admin'));
    } catch (err) {
      toast.error(`Failed to load requests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pendingCount = data.requests.filter((r) => r.status === 'pending').length;
  const shown = data.requests.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-6 h-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Organiser Requests</h1>
          <p className="text-sm text-muted-foreground">Members asking to manage an event organiser page. Confirm they’re who they say before approving.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="rounded-full capitalize" onClick={() => setFilter(f)} role="tab" aria-selected={filter === f}>
            {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…</p>
      ) : shown.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
          <BadgeCheck className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
          {filter === 'pending' ? 'No requests waiting.' : 'Nothing here.'}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => <RequestCard key={r.id} req={r} organisers={data.organisers} onDecided={load} />)}
        </div>
      )}
    </div>
  );
};

export default OrganiserRequestsAdminPage;
