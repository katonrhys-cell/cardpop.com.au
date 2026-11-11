import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Loader2, Megaphone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { organiserPath } from '@/utils/eventOrganisers.js';

// Account → My Events: where a member asks to be confirmed as an event
// organiser, sees where that stands, and — once an admin approves — gets to
// their organiser page. docs/event-organiser-access.md

const Shell = ({ icon: Icon, tone, title, children }) => (
  <section className={`rounded-2xl border p-5 ${tone}`} aria-label="Event organiser access">
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-base">{title}</h2>
        {children}
      </div>
    </div>
  </section>
);

const RequestForm = ({ defaultName = '', onSubmit, onCancel }) => {
  const [form, setForm] = useState({ organiserName: defaultName, websiteUrl: '', message: '' });
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        organiserName: form.organiserName.trim(),
        websiteUrl: form.websiteUrl.trim() || null,
        message: form.message.trim() || null,
      });
      toast.success('Request sent — we’ll confirm it shortly.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="org-name" className="text-xs font-bold uppercase tracking-wide">Organiser or business name</Label>
        <Input id="org-name" required minLength={2} maxLength={120} value={form.organiserName} onChange={set('organiserName')} placeholder="e.g. Oz Comic-Con" disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-site" className="text-xs font-bold uppercase tracking-wide">Website or social page</Label>
        <Input id="org-site" inputMode="url" value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="ozcomiccon.com or instagram.com/…" disabled={busy} />
        <p className="text-xs text-muted-foreground">Helps us confirm it’s really you.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-msg" className="text-xs font-bold uppercase tracking-wide">Anything else we should know? (optional)</Label>
        <Textarea id="org-msg" rows={3} maxLength={1000} value={form.message} onChange={set('message')} disabled={busy} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || form.organiserName.trim().length < 2} className="font-bold">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />} Send request
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
};

export default function OrganiserAccessCard({ access }) {
  const { loading, request, organiser, submit, error } = access;
  const [showForm, setShowForm] = useState(false);

  if (loading || error) return null;

  if (organiser) {
    const path = organiserPath(organiser);
    return (
      <Shell icon={BadgeCheck} tone="border-emerald-300 bg-emerald-500/5" title={`You manage ${organiser.name}`}>
        <p className="text-sm text-muted-foreground mt-1">
          CardPop confirmed you as this organiser. Edit its logo, description and links from the page itself.
        </p>
        {path && (
          <Button asChild size="sm" className="mt-3 rounded-xl font-bold">
            <Link to={path}>Open &amp; edit your organiser page</Link>
          </Button>
        )}
      </Shell>
    );
  }

  if (request?.status === 'pending') {
    return (
      <Shell icon={Clock} tone="border-amber-300 bg-amber-500/5" title="Organiser request with the CardPop team">
        <p className="text-sm text-muted-foreground mt-1">
          You asked to manage <strong>{request.organiser_name}</strong>. We’ll check it and email you the moment it’s confirmed.
        </p>
      </Shell>
    );
  }

  const rejected = request?.status === 'rejected';
  return (
    <Shell
      icon={rejected ? XCircle : Megaphone}
      tone={rejected ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-primary/5'}
      title={rejected ? 'Your organiser request wasn’t approved' : 'Do you run card shows or events?'}
    >
      {rejected ? (
        <p className="text-sm text-muted-foreground mt-1">
          {request.decision_note ? <>Reason: {request.decision_note}. </> : null}
          You can send a new request with more detail.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground mt-1">
          Ask to be confirmed as an organiser and you’ll be able to edit your own organiser page — logo, description and links — alongside your events.
        </p>
      )}
      {showForm ? (
        <RequestForm
          defaultName={request?.organiser_name || ''}
          onSubmit={async (payload) => { await submit(payload); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button size="sm" variant={rejected ? 'outline' : 'default'} className="mt-3 rounded-xl font-bold" onClick={() => setShowForm(true)}>
          {rejected ? 'Send a new request' : 'Become an organiser'}
        </Button>
      )}
    </Shell>
  );
}
