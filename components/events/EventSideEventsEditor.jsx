import React from 'react';
import { ArrowDown, ArrowUp, CalendarPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  MAX_SIDE_EVENTS,
  MAX_SIDE_EVENT_TITLE_CHARS,
  MAX_SIDE_EVENT_DESCRIPTION_CHARS,
  emptySideEvent,
  safeHttpUrl,
} from '@/utils/eventSideEvents.js';

// Side events for the event form: the tournaments and extras inside the event
// (a Friday sealed night, a Saturday main event, a Sunday showdown). Controlled:
// `value` is a list of form rows, all strings —
// { title, date, start_time, end_time, entry_fee_aud, player_cap, description, url }
// — which the form normalises with cleanSideEvents on save. The event page
// shows them as a day-by-day schedule (components/events/EventSideEvents.jsx).
const Row = ({ item, index, count, onChange, onRemove, onMove, disabled }) => {
  const n = index + 1;
  const set = (key) => (e) => onChange({ ...item, [key]: e.target.value });
  const linkTyped = item.url.trim().length > 0;
  const linkOk = !linkTyped || Boolean(safeHttpUrl(item.url));

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor={`side-title-${n}`} className="sr-only">Side event {n} name</Label>
          <Input
            id={`side-title-${n}`}
            value={item.title}
            onChange={(e) => onChange({ ...item, title: e.target.value.slice(0, MAX_SIDE_EVENT_TITLE_CHARS) })}
            placeholder="Name — e.g. Classic Constructed, Sealed Deck, Silver Age Showdown"
            maxLength={MAX_SIDE_EVENT_TITLE_CHARS}
            disabled={disabled}
            className="h-9 font-semibold"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move side event ${n} up`}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move side event ${n} down`}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove} disabled={disabled} aria-label={`Remove side event ${n}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="col-span-2 sm:col-span-2 space-y-1">
          <Label htmlFor={`side-date-${n}`} className="text-xs text-muted-foreground">Day</Label>
          <Input id={`side-date-${n}`} type="date" value={item.date} onChange={set('date')} disabled={disabled} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`side-start-${n}`} className="text-xs text-muted-foreground">Starts</Label>
          <Input id={`side-start-${n}`} type="time" value={item.start_time} onChange={set('start_time')} disabled={disabled} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`side-end-${n}`} className="text-xs text-muted-foreground">Ends</Label>
          <Input id={`side-end-${n}`} type="time" value={item.end_time} onChange={set('end_time')} disabled={disabled} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`side-fee-${n}`} className="text-xs text-muted-foreground">Entry (AUD)</Label>
          <Input
            id={`side-fee-${n}`} type="number" inputMode="decimal" min="0" step="0.01"
            value={item.entry_fee_aud} onChange={set('entry_fee_aud')}
            placeholder="0 = free" disabled={disabled} className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`side-cap-${n}`} className="text-xs text-muted-foreground">Player cap (optional)</Label>
          <Input
            id={`side-cap-${n}`} type="number" inputMode="numeric" min="1" step="1"
            value={item.player_cap} onChange={set('player_cap')}
            placeholder="e.g. 250" disabled={disabled} className="h-9"
          />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor={`side-url-${n}`} className="text-xs text-muted-foreground">Registration link (optional)</Label>
          <Input
            id={`side-url-${n}`} type="url" value={item.url} onChange={set('url')}
            placeholder="https://…" disabled={disabled} className="h-9"
            aria-invalid={!linkOk ? true : undefined}
          />
          {!linkOk && <p className="text-xs text-destructive">Use a full link starting with http:// or https://</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`side-desc-${n}`} className="text-xs text-muted-foreground">Details (optional)</Label>
        <Textarea
          id={`side-desc-${n}`}
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value.slice(0, MAX_SIDE_EVENT_DESCRIPTION_CHARS) })}
          placeholder="Format, rules, rounds, what to bring…"
          maxLength={MAX_SIDE_EVENT_DESCRIPTION_CHARS}
          rows={2}
          disabled={disabled}
        />
        <p className="text-[11px] text-muted-foreground text-right tabular-nums">{item.description.length}/{MAX_SIDE_EVENT_DESCRIPTION_CHARS}</p>
      </div>
    </div>
  );
};

const EventSideEventsEditor = ({ value = [], onChange, disabled = false, defaultDate = '' }) => {
  const items = value;
  const named = items.filter((s) => s.title.trim()).length;

  const update = (i, next) => onChange(items.map((s, j) => (j === i ? next : s)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  // A new row starts on the previous row's day (side events cluster by day),
  // else the event's own first day.
  const add = () => {
    if (items.length >= MAX_SIDE_EVENTS) { toast.error(`An event lists up to ${MAX_SIDE_EVENTS} side events.`); return; }
    const last = items[items.length - 1];
    onChange([...items, { ...emptySideEvent(), date: last?.date || defaultDate || '' }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="font-bold">
          Side Events <span className="text-muted-foreground font-normal text-xs">(optional — shown as a day-by-day schedule on the event page)</span>
        </Label>
        <span className="text-xs text-muted-foreground tabular-nums">{named} listed</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        List each tournament or extra inside your event — a sealed night, the main event, a showdown. Give each a day and start time so collectors can plan the weekend; the page sorts them by day and time for you. Only the name is required.
      </p>

      {items.map((item, i) => (
        <Row
          key={i}
          item={item}
          index={i}
          count={items.length}
          disabled={disabled}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
          onMove={(dir) => move(i, dir)}
        />
      ))}

      <Button
        type="button" variant="outline" size="sm" onClick={add}
        disabled={disabled || items.length >= MAX_SIDE_EVENTS}
        className="gap-1.5"
      >
        <CalendarPlus className="w-4 h-4" aria-hidden="true" /> {items.length ? 'Add another side event' : 'Add a side event'}
      </Button>
    </div>
  );
};

export default EventSideEventsEditor;
