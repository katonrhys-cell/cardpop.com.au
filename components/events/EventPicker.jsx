import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronsUpDown, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/lib/supabaseClient.js';
import {
  EVENT_PICKER_COLUMNS,
  eventPath,
  eventSubtitle,
  recentWindowStart,
  sanitizeEventQuery,
} from '@/utils/eventPicker.js';
import { cn } from '@/lib/utils';

const RESULT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Searchable "Link to an event" field for the Start a Discussion form.
 *
 * With no search it lists recent and upcoming events (a month back onwards,
 * soonest first); typing searches every public event by title, venue or
 * suburb in the database. `value` is the selected event row (or null) and
 * `onSelect(event | null)` receives the whole row.
 */
const EventPicker = ({ value, onSelect, disabled = false, className = '', id = 'event' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const term = sanitizeEventQuery(query);
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      let request = supabase.from('events_public').select(EVENT_PICKER_COLUMNS).limit(RESULT_LIMIT);
      request = term
        ? request
          .or(`title.ilike.%${term}%,venue_name.ilike.%${term}%,suburb.ilike.%${term}%`)
          .order('start_date', { ascending: false })
        : request
          .gte('start_date', recentWindowStart())
          .order('start_date', { ascending: true });
      const { data, error: fetchError } = await request;
      if (cancelled) return;
      if (fetchError) {
        console.error('Event search failed:', fetchError);
        setError(true);
        setResults([]);
      } else {
        setResults(data || []);
      }
      setLoading(false);
    }, term ? SEARCH_DEBOUNCE_MS : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query]);

  const choose = (event) => {
    onSelect?.(event);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-12 w-full justify-between rounded-xl bg-background font-normal"
          >
            {value ? (
              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{value.title}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Search for an event…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type an event, venue or suburb…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Searching events…</p>
              ) : error ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load events. Try again shortly.</p>
              ) : (
                <>
                  <CommandEmpty>
                    <span className="block px-2 text-sm text-muted-foreground">
                      No event found. Check the spelling, or post without linking one.
                    </span>
                  </CommandEmpty>
                  <CommandGroup heading={sanitizeEventQuery(query) ? 'Matches' : 'Recent & upcoming'}>
                    {results.map((event) => (
                      <CommandItem
                        key={event.id}
                        value={event.id}
                        onSelect={() => choose(event)}
                        className="flex items-center gap-3"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{event.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{eventSubtitle(event)}</span>
                        </span>
                        <Check className={cn('h-4 w-4', event.id === value?.id ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{value.title}</p>
            <p className="truncate text-xs text-muted-foreground">{eventSubtitle(value)}</p>
          </div>
          <Link
            to={eventPath(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            View event <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => choose(null)}
            disabled={disabled}
            aria-label="Unlink event"
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default EventPicker;
