import React, { useEffect, useState } from 'react';
import { Inbox, Loader2, Mail } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { organiserMessageTopicLabel } from '@/utils/organiserMessages.js';

// The owner's view of their organiser page: the messages collectors have sent
// them (GET /organiser-messages/inbox). Only messages that passed the screen,
// or that an admin released, are ever returned. docs/organiser-messages.md

const replyHref = (m, orgName) => (
  `mailto:${m.sender_email}?subject=${encodeURIComponent(`Re: your message to ${orgName}`)}`
);

export default function OrganiserInbox({ org }) {
  const [state, setState] = useState({ status: 'loading', messages: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiServerClient.fetch('/organiser-messages/inbox');
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Failed to load');
        if (!cancelled) setState({ status: 'ready', messages: Array.isArray(body.messages) ? body.messages : [] });
      } catch {
        if (!cancelled) setState({ status: 'error', messages: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [org.id]);

  const { status, messages } = state;

  return (
    <section id="messages" aria-labelledby="org-inbox" className="scroll-mt-24">
      <div className="flex items-center gap-4 mb-2">
        <Inbox className="w-6 h-6 text-primary" aria-hidden="true" />
        <h2 id="org-inbox" className="text-2xl font-bold whitespace-nowrap">Your messages</h2>
        <div className="flex-1 h-px bg-border" />
        {status === 'ready' && <Badge variant="secondary">{messages.length}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Only you can see these. Collectors write to you from this page; every message is checked before it reaches you.
      </p>

      {status === 'loading' ? (
        <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…</p>
      ) : status === 'error' ? (
        <p className="text-muted-foreground">We couldn’t load your messages. Refresh the page to try again.</p>
      ) : messages.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-2xl">
          No messages yet. They’ll appear here, and we’ll email you when one arrives.
        </div>
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{m.sender_name}</h3>
                    <Badge variant="secondary">{organiserMessageTopicLabel(m.topic)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-full gap-1.5">
                  <a href={replyHref(m, org.name)}><Mail className="w-3.5 h-3.5" aria-hidden="true" /> Reply by email</a>
                </Button>
              </div>
              <p className="text-sm mt-3 whitespace-pre-line break-words">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground mt-4">
        Something here that shouldn’t have reached you? Forward the email to admin@cardpop.com.au and we’ll deal with it.
      </p>
    </section>
  );
}
