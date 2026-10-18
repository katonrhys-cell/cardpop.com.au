import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronsUpDown, ExternalLink, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import usePlayers from '@/hooks/usePlayers.js';
import { matchPlayers, playerInitials, playerPath, playerSubtitle } from '@/utils/players.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { cn } from '@/lib/utils';

export const PlayerAvatar = ({ player, className = 'h-9 w-9' }) => {
  const [broken, setBroken] = useState(false);
  const src = player?.image_url && !broken ? publicImageUrl(player.image_url) : null;
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground', className)}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{playerInitials(player?.name) || <UserRound className="h-4 w-4" />}</span>
      )}
    </div>
  );
};

/**
 * Searchable "Player" field for the card form.
 *
 * Picks from the published players (hooks/usePlayers.js), matched in the
 * browser by utils/players.js so typing "doncic", "wemby" or "MJ" finds the
 * right row. Selecting one tags the card (`value` is the player id) and shows
 * the chosen player with a "View player page" link that opens in a new tab,
 * so a half-finished listing is never abandoned. `onSelect(player | null)`
 * receives the whole row so the form can, for example, default the card name.
 */
const PlayerPicker = ({ value, onSelect, disabled = false, className = '', id = 'player' }) => {
  const { players, loading, error } = usePlayers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => players.find((p) => p.id === value) || null, [players, value]);
  const results = useMemo(() => matchPlayers(players, query, 12), [players, query]);

  const choose = (player) => {
    onSelect?.(player);
    setOpen(false);
    setQuery('');
  };

  // The table is unreachable (or the migration hasn't landed): keep the form
  // usable and say so quietly rather than rendering a broken control.
  if (error && !players.length) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Player tagging is unavailable right now — you can still save the card.
      </p>
    );
  }

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
            disabled={disabled || loading}
            className="h-11 w-full justify-between bg-background font-normal"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <PlayerAvatar player={selected} className="h-6 w-6 text-[10px]" />
                <span className="truncate">{selected.name}</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {playerSubtitle(selected)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{loading ? 'Loading players…' : 'Search for a player…'}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type a name — e.g. LeBron, Wemby, Daicos"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                <span className="block px-2 text-sm text-muted-foreground">
                  No player found. Only the most collected athletes have pages so far — leave this blank and the card name still carries the player.
                </span>
              </CommandEmpty>
              <CommandGroup heading={query ? 'Matches' : 'Most collected'}>
                {results.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => choose(p)}
                    className="flex items-center gap-3"
                  >
                    <PlayerAvatar player={p} className="h-8 w-8 text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{playerSubtitle(p)}</span>
                    </span>
                    <Check className={cn('h-4 w-4', p.id === value ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <PlayerAvatar player={selected} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">{selected.headline || playerSubtitle(selected)}</p>
          </div>
          <Link
            to={playerPath(selected)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            View player page <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => choose(null)}
            disabled={disabled}
            aria-label="Remove player"
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PlayerPicker;
