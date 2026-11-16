import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Send, ShieldCheck } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ORGANISER_MESSAGE_TOPICS, ORGANISER_MESSAGE_MAX, organiserMessageProblem,
} from '@/utils/organiserMessages.js';

// "Message the organiser" on an organiser page. Signed-in members only; the
// message is screened server-side (POST /organiser-messages) before anyone
// receives it, and goes to the CardPop team when the page has no owner yet.
// docs/organiser-messages.md

export default function OrganiserMessageDialog({ org, open, onOpenChange }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [topic, setTopic] = useState(ORGANISER_MESSAGE_TOPICS[0].value);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const next = encodeURIComponent(location.pathname);
  const hasOwner = Boolean(org.owner_id);
  const problem = organiserMessageProblem(message);

  const submit = async (e) => {
    e.preventDefault();
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const res = await apiServerClient.fetch('/organiser-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organiserId: org.id, topic, message: message.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.issues?.[0]?.message || body.error || 'We could not send your message.');
      toast.success(hasOwner
        ? `Message sent. It’s checked, then passed on to ${org.name}.`
        : 'Message sent to the CardPop team.');
      setMessage('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message {org.name}</DialogTitle>
          <DialogDescription>
            {hasOwner
              ? `Feedback, a question or a trader enquiry — it goes to the organiser of ${org.name}.`
              : `${org.name} hasn’t linked an account to this page yet, so your message goes to the CardPop team, who will pass it on where they can.`}
          </DialogDescription>
        </DialogHeader>

        {!currentUser ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Sign in to send a message. It’s free to join, and it means organisers know who is writing to them.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="font-bold"><Link to={`/login?next=${next}`}>Sign in</Link></Button>
              <Button asChild variant="outline"><Link to={`/signup?next=${next}`}>Join free</Link></Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-msg-topic" className="text-xs font-bold uppercase tracking-wide">What’s it about?</Label>
              <select
                id="org-msg-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={busy}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ORGANISER_MESSAGE_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-msg-body" className="text-xs font-bold uppercase tracking-wide">Your message</Label>
              <Textarea
                id="org-msg-body"
                rows={6}
                maxLength={ORGANISER_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={busy}
                placeholder="What would you like them to know?"
                required
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/{ORGANISER_MESSAGE_MAX}</p>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Every message is checked before it’s passed on, and abusive messages aren’t delivered.
                {' '}Your name and email address ({currentUser.email}) are shared with {hasOwner ? 'the organiser' : 'the CardPop team'} so they can reply.
              </span>
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy || Boolean(problem)} className="font-bold">
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4 mr-2" aria-hidden="true" />}
                Send message
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
