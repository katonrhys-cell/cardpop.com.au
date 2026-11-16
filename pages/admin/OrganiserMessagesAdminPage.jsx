import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Inbox, Loader2, Mail, MessageSquareText, ShieldAlert, X } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { organiserMessageTopicLabel } from '@/utils/organiserMessages.js';

// Admin → Organiser Messages. Every message a member sends to an organiser is
// screened first. Two kinds need an admin: ones the screen HELD (flagged, or it
// could not run) — release or dismiss — and ones FORWARDED here because the
// organiser page has no owner, which are CardPop's to answer or pass on.
// docs/organiser-messages.md

const STATUS = {
  held: { label: 'Held', variant: 'destructive' },
  forwarded: { label: 'For CardPop', variant: 'secondary' },
  delivered: { label: 'Delivered', variant: 'default' },
  released: { label: 'Released', variant: 'default' },
  dismissed: { label: 'Dismissed', variant: 'outline' },
};

const FILTERS = [
  ['held', 'Held'],
  ['forwarded', 'For CardPop'],
  ['delivered', 'Delivered'],
  ['dismissed', 'Dismissed'],
  ['all', 'All'],
];
// "Delivered" covers messages an admin released, too.
const matches = (filter, status) => filter === 'all'
  || status === filter
  || (filter === 'delivered' && status === 'released');

const callApi = async (path, init) => {
  const res = await apiServerClient.fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'Request failed');
  return body;
};

const MessageCard = ({ msg, onDecided }) => {
  const [busy, setBusy] = useState(false);
  const status = STATUS[msg.status] || { label: msg.status, variant: 'secondary' };
  const orgName = msg.organiser?.name || 'Removed organiser';

  const decide = async (action) => {
    setBusy(true);
    try {
      const body = await callApi(`/organiser-messages/admin/${msg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      toast.success(
        action === 'dismiss' ? 'Dismissed — nobody else will see it.'
          : body.status === 'released' ? `Released — ${orgName} has been sent it.`
            : 'Released — this page has no organiser linked, so it’s yours to answer.',
      );
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
            <h3 className="font-semibold">
              To{' '}
              {msg.organiser?.slug
                ? <Link className="text-primary hover:underline" to={`/events/organisers/${msg.organiser.slug}`}>{orgName}</Link>
                : orgName}
            </h3>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="outline">{organiserMessageTopicLabel(msg.topic)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            From {msg.sender_name}
            {' · '}<a className="text-primary hover:underline" href={`mailto:${msg.sender_email}`}>{msg.sender_email}</a>
            {' · '}{new Date(msg.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        {msg.status === 'forwarded' && (
          <Button asChild size="sm" variant="outline" className="rounded-full gap-1.5">
            <a href={`mailto:${msg.sender_email}?subject=${encodeURIComponent(`Re: your message to ${orgName}`)}`}>
              <Mail className="w-3.5 h-3.5" aria-hidden="true" /> Reply by email
            </a>
          </Button>
        )}
      </div>

      <p className="text-sm mt-3 whitespace-pre-line break-words">{msg.body}</p>

      {msg.scan_verdict !== 'clean' && (
        <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {msg.scan_verdict === 'flagged'
              ? <>Flagged by the screen{msg.scan_category ? ` (${msg.scan_category.replace('_', ' ')})` : ''}{msg.scan_reason ? `: ${msg.scan_reason}` : '.'}</>
              : <>Not screened{msg.scan_reason ? `: ${msg.scan_reason}` : '.'} Read it before releasing.</>}
          </span>
        </p>
      )}

      {msg.status === 'held' && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" disabled={busy} onClick={() => decide('release')}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4 mr-1" aria-hidden="true" />}
              {msg.organiser?.hasOwner ? 'Release to organiser' : 'It’s fine — keep for CardPop'}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide('dismiss')}>
              <X className="w-4 h-4 mr-1" aria-hidden="true" /> Dismiss
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The organiser has not seen this. The sender was told only that their message was sent.
          </p>
        </div>
      )}
    </div>
  );
};

const OrganiserMessagesAdminPage = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('held');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await callApi('/organiser-messages/admin');
      setMessages(Array.isArray(body.messages) ? body.messages : []);
    } catch (err) {
      toast.error(`Failed to load messages: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const count = (f) => messages.filter((m) => matches(f, m.status)).length;
  const shown = messages.filter((m) => matches(filter, m.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquareText className="w-6 h-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Organiser Messages</h1>
          <p className="text-sm text-muted-foreground">
            Messages collectors send from organiser pages. Held ones wait for you; “For CardPop” ones went to a page nobody has claimed.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter messages">
        {FILTERS.map(([value, label]) => (
          <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter(value)} role="tab" aria-selected={filter === value}>
            {label}{(value === 'held' || value === 'forwarded') && count(value) > 0 ? ` (${count(value)})` : ''}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…</p>
      ) : shown.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
          {filter === 'held' ? 'Nothing held for review.' : 'Nothing here.'}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((m) => <MessageCard key={m.id} msg={m} onDecided={load} />)}
        </div>
      )}
    </div>
  );
};

export default OrganiserMessagesAdminPage;
