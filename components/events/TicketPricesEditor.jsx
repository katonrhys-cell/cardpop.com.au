import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TICKET_PRICE_TYPES, MAX_GROUP_PRICES, MAX_GROUP_SIZE } from '@/utils/eventTicketPrices.js';

const inputCls = 'bg-background h-11 rounded-xl';

// Extra ticket prices for the event form: tick Child / VIP / GA Early Access /
// GA Late Access to give each a price, and Group to add one or more
// "N people for $X" prices. Controlled — `value` is the form's rows
// ({ type, price_aud, group_size } with string inputs); saving normalises them
// with cleanTicketPrices() (utils/eventTicketPrices.js).
const TicketPricesEditor = ({ value = [], onChange, disabled = false }) => {
  const single = TICKET_PRICE_TYPES.filter(t => t.type !== 'group');
  const groups = value.map((row, i) => ({ row, i })).filter(({ row }) => row.type === 'group');
  const hasGroup = groups.length > 0;

  const rowFor = (type) => value.find(r => r.type === type);
  const toggle = (type, on) => onChange(on
    ? [...value, type === 'group' ? { type, group_size: '', price_aud: '' } : { type, price_aud: '' }]
    : value.filter(r => r.type !== type));
  const update = (index, patch) => onChange(value.map((r, j) => (j === index ? { ...r, ...patch } : r)));
  const removeAt = (index) => onChange(value.filter((_, j) => j !== index));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold">Other Ticket Prices</p>
        <p className="text-xs text-muted-foreground">Tick the ticket types this event sells — each one is listed on the event page under Entry.</p>
      </div>

      {single.map(({ type, label }) => {
        const index = value.findIndex(r => r.type === type);
        const row = rowFor(type);
        const id = `ticket_price_${type}`;
        return (
          <div key={type} className="flex flex-wrap items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
            <Switch id={`${id}_on`} checked={!!row} onCheckedChange={on => toggle(type, on)} disabled={disabled} aria-label={`${label} ticket`} />
            <Label htmlFor={`${id}_on`} className="font-semibold text-sm cursor-pointer min-w-[8rem]">{label}</Label>
            {row && (
              <div className="flex items-center gap-2 ml-auto">
                <Label htmlFor={id} className="text-xs text-muted-foreground">Price (AUD)</Label>
                <Input
                  id={id} type="number" min="0" step="0.01" inputMode="decimal"
                  value={row.price_aud} onChange={e => update(index, { price_aud: e.target.value })}
                  className={`${inputCls} w-32`} placeholder="0.00" disabled={disabled}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="p-3 bg-muted/20 rounded-xl border border-border space-y-3">
        <div className="flex items-center gap-3">
          <Switch id="ticket_price_group_on" checked={hasGroup} onCheckedChange={on => toggle('group', on)} disabled={disabled} aria-label="Group tickets" />
          <Label htmlFor="ticket_price_group_on" className="font-semibold text-sm cursor-pointer">Group</Label>
          {hasGroup && <span className="text-xs text-muted-foreground">A price for a set number of people, e.g. 4 people for $40</span>}
        </div>
        {groups.map(({ row, i }, n) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor={`group_size_${n}`} className="text-xs text-muted-foreground">People</Label>
              <Input
                id={`group_size_${n}`} type="number" min="2" max={MAX_GROUP_SIZE} step="1" inputMode="numeric"
                value={row.group_size} onChange={e => update(i, { group_size: e.target.value })}
                className={`${inputCls} w-24`} placeholder="4" disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`group_price_${n}`} className="text-xs text-muted-foreground">Price for the group (AUD)</Label>
              <Input
                id={`group_price_${n}`} type="number" min="0" step="0.01" inputMode="decimal"
                value={row.price_aud} onChange={e => update(i, { price_aud: e.target.value })}
                className={`${inputCls} w-36`} placeholder="0.00" disabled={disabled}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => removeAt(i)} disabled={disabled} aria-label={`Remove group price ${n + 1}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {hasGroup && groups.length < MAX_GROUP_PRICES && (
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onChange([...value, { type: 'group', group_size: '', price_aud: '' }])} disabled={disabled}>
            <Plus className="w-4 h-4 mr-1" /> Add another group price
          </Button>
        )}
      </div>
    </div>
  );
};

export default TicketPricesEditor;
