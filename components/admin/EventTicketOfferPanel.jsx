import React from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MousePointerClick, Eye } from 'lucide-react';

// Admin → Events → event form → "Member Offer" tab. Controlled: the form owns
// the state and saves it with the event (lib/eventTicketOffers.js).
const EventTicketOfferPanel = ({ value, onChange, stats, ticketUrl, disabled }) => {
  const set = (field, v) => onChange({ ...value, [field]: v });
  const inputCls = 'bg-background rounded-xl h-11';
  const fmt = (ts) => (ts ? format(new Date(ts), 'd MMM yyyy, h:mm a') : 'never');

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground space-y-1">
        <p>
          Tickets are sold on the organiser's site. The <strong>ticket code</strong> is shown on the event page to
          signed-in members only; everyone else sees the offer line and a prompt to sign in.
        </p>
        <p>
          The <strong>referral link</strong> replaces the Tickets URL as the "Get Tickets" destination, so the
          organiser can credit CardPop. Both disappear once the event ends.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="offer_text" className="font-bold">Offer line <span className="text-muted-foreground font-normal text-xs">(public)</span></Label>
        <Input id="offer_text" value={value.offer_text} onChange={e => set('offer_text', e.target.value)} maxLength={120} className={inputCls} placeholder="e.g. 15% off GA tickets for CardPop members" disabled={disabled} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="discount_code" className="font-bold">Ticket discount code <span className="text-muted-foreground font-normal text-xs">(from the organiser — members only)</span></Label>
        <Input id="discount_code" value={value.discount_code} onChange={e => set('discount_code', e.target.value)} maxLength={60} className={`${inputCls} font-mono`} placeholder="e.g. CARDPOP15" autoComplete="off" disabled={disabled} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="referral_url" className="font-bold">Referral / tracking link <span className="text-muted-foreground font-normal text-xs">(from the organiser or ticket platform)</span></Label>
        <Input id="referral_url" type="url" value={value.referral_url} onChange={e => set('referral_url', e.target.value)} className={inputCls} placeholder="https://…?ref=cardpop" disabled={disabled} />
        <p className="text-xs text-muted-foreground">
          {value.referral_url.trim()
            ? '"Get Tickets" will open this link.'
            : ticketUrl ? `Blank — "Get Tickets" opens the Tickets URL (${ticketUrl}).` : 'Blank — "Get Tickets" opens the Tickets URL from the Organiser tab.'}
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
        <Switch checked={value.is_active} onCheckedChange={v => set('is_active', v)} disabled={disabled} />
        <div>
          <p className="text-sm font-semibold">Offer live</p>
          <p className="text-xs text-muted-foreground">Switch off to hide the code and referral link without losing them.</p>
        </div>
      </div>

      {stats && (
        <div className="pt-2 border-t border-border space-y-3">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Tracking</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><MousePointerClick className="w-3.5 h-3.5" /> Ticket clicks</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{stats.ticket_clicks}</p>
              <p className="text-xs text-muted-foreground">Last: {fmt(stats.last_click_at)}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Eye className="w-3.5 h-3.5" /> Code reveals</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{stats.code_reveals}</p>
              <p className="text-xs text-muted-foreground">Last: {fmt(stats.last_reveal_at)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Ticket sales happen on the organiser's site — ask them for the referral sales report.</p>
        </div>
      )}
    </div>
  );
};

export default EventTicketOfferPanel;
