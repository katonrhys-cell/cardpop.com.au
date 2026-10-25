import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, Copy, Check, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { revealEventTicketCode } from '@/lib/eventTicketOffers.js';

// The member ticket discount for an event. Signed-in members reveal the
// organiser's code (counted as a reveal); anyone else sees the offer line and
// a sign-in prompt — the code never reaches the browser until then.
const MemberOffer = ({ eventId, offer, className }) => {
  const { isAuthenticated } = useAuth();
  const [code, setCode] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = async () => {
    setRevealing(true);
    try {
      const value = await revealEventTicketCode(eventId);
      if (value) setCode(value);
      else toast.error('This offer is no longer available.');
    } catch {
      toast.error("Couldn't load the code — please try again.");
    } finally {
      setRevealing(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied — enter it at checkout on the ticket site.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the code and copy it manually.');
    }
  };

  return (
    <div className={`rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 ${className}`} data-testid="event-ticket-offer">
      <div className="flex items-start gap-3">
        <BadgePercent className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-bold text-foreground">Member ticket offer</p>
          <p className="text-sm text-muted-foreground leading-snug">
            {offer.offerText || 'CardPop members get a discount on tickets to this event.'}
          </p>
        </div>
      </div>

      {code ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-xl border border-border bg-background px-3 py-2 font-mono text-base font-bold tracking-wider text-foreground">
            {code}
          </code>
          <Button type="button" variant="outline" className="rounded-xl font-semibold shrink-0" onClick={copy}>
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      ) : isAuthenticated ? (
        <Button type="button" variant="outline" className="w-full rounded-xl font-semibold" onClick={reveal} disabled={revealing}>
          {revealing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BadgePercent className="w-4 h-4 mr-2" />}
          Reveal ticket code
        </Button>
      ) : (
        <Button variant="outline" className="w-full rounded-xl font-semibold" asChild>
          <Link to="/login" state={{ from: { pathname: window.location.pathname } }}>
            <Lock className="w-4 h-4 mr-2" /> Sign in to reveal the code
          </Link>
        </Button>
      )}

      {code && (
        <p className="text-xs text-muted-foreground">Enter this code when you buy tickets on the organiser's site.</p>
      )}
    </div>
  );
};

// Nothing to show without a code — a referral link alone just changes where
// "Get Tickets" goes.
const EventTicketOffer = ({ eventId, offer, className = '' }) => (
  offer?.hasCode ? <MemberOffer eventId={eventId} offer={offer} className={className} /> : null
);

export default EventTicketOffer;
