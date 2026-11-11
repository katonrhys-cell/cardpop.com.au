import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  MAX_EVENT_PRIZES,
  MAX_PRIZE_PHOTOS,
  MAX_PRIZE_PLACE_CHARS,
  MAX_PRIZE_REWARD_CHARS,
  MAX_PRIZE_POOL_CHARS,
  emptyPrize,
} from '@/utils/eventPrizes.js';
import { eventImageFileError, EVENT_IMAGE_ACCEPT } from '@/utils/eventFormValidation.js';

// Prize table for the event form. Controlled: `value` is
// { pool, prizes } where `pool` is the headline total (a string) and `prizes`
// are rows in display order, each { place, reward, photos } and a photo is
// { url } (already saved) or { file, preview } (picked — uploaded when the
// form is saved, see EventFormModal). The event page shows the section above
// the videos (components/events/EventPrizes.jsx).
const PrizeRow = ({ prize, index, count, onChange, onRemove, onMove, disabled }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const n = index + 1;
  const photos = prize.photos;

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_PRIZE_PHOTOS - photos.length;
    const problems = files.map((f) => eventImageFileError(f));
    const ok = files.filter((_, i) => !problems[i]);
    const firstProblem = problems.find(Boolean);
    if (firstProblem) {
      const skipped = problems.filter(Boolean).length;
      toast.error(skipped === 1 ? firstProblem : `${skipped} files were skipped. ${firstProblem}`);
    }
    if (ok.length > room) toast.error(`A prize holds up to ${MAX_PRIZE_PHOTOS} photos.`);
    const added = ok.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (added.length) onChange({ ...prize, photos: [...photos, ...added] });
    if (inputRef.current) inputRef.current.value = '';
  };
  const removePhoto = (i) => onChange({ ...prize, photos: photos.filter((_, j) => j !== i) });
  const movePhoto = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...prize, photos: next });
  };

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-3 space-y-3 transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!disabled) addFiles(e.dataTransfer.files); }}
    >
      <div className="flex items-start gap-2">
        <div className="w-32 shrink-0 space-y-1">
          <Label htmlFor={`prize-place-${n}`} className="sr-only">Prize {n} placing</Label>
          <Input
            id={`prize-place-${n}`}
            value={prize.place}
            onChange={(e) => onChange({ ...prize, place: e.target.value.slice(0, MAX_PRIZE_PLACE_CHARS) })}
            placeholder="1st Place"
            maxLength={MAX_PRIZE_PLACE_CHARS}
            disabled={disabled}
            className="h-9 font-semibold"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <Label htmlFor={`prize-reward-${n}`} className="sr-only">Prize {n} reward</Label>
          <Input
            id={`prize-reward-${n}`}
            value={prize.reward}
            onChange={(e) => onChange({ ...prize, reward: e.target.value.slice(0, MAX_PRIZE_REWARD_CHARS) })}
            placeholder="e.g. $1,500 USD + 4 Gold Foil Blossom of Spring + Pro Tour Invitation"
            maxLength={MAX_PRIZE_REWARD_CHARS}
            disabled={disabled}
            className="h-9"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move prize ${n} up`}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move prize ${n} down`}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove} disabled={disabled} aria-label={`Remove prize ${n}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2 list-none p-0 m-0">
          {photos.map((photo, i) => (
            <li key={photo.url || photo.preview} className="relative aspect-[5/7] rounded-lg overflow-hidden bg-muted">
              <img src={photo.preview || photo.url} alt={`Prize ${n} card photo ${i + 1}`} className="w-full h-full object-cover" />
              <Button
                type="button" variant="destructive" size="icon"
                className="absolute top-1 right-1 h-6 w-6 rounded-full shadow"
                onClick={() => removePhoto(i)} disabled={disabled}
                aria-label={`Remove prize ${n} photo ${i + 1}`}
              >
                <X className="w-3 h-3" />
              </Button>
              <div className="absolute bottom-1 left-1 flex gap-1">
                <Button type="button" variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow"
                  onClick={() => movePhoto(i, -1)} disabled={disabled || i === 0} aria-label={`Move prize ${n} photo ${i + 1} earlier`}>
                  <ArrowLeft className="w-3 h-3" />
                </Button>
                <Button type="button" variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow"
                  onClick={() => movePhoto(i, 1)} disabled={disabled || i === photos.length - 1} aria-label={`Move prize ${n} photo ${i + 1} later`}>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || photos.length >= MAX_PRIZE_PHOTOS}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ImagePlus className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Add photos of the cards won</span>
        <span className="text-xs text-muted-foreground">{photos.length}/{MAX_PRIZE_PHOTOS} — click or drag</span>
      </button>
      <input
        ref={inputRef} type="file" multiple className="hidden" tabIndex={-1}
        aria-label={`Add photos to prize ${n}`}
        accept={EVENT_IMAGE_ACCEPT}
        onChange={(e) => addFiles(e.target.files)} disabled={disabled}
      />
    </div>
  );
};

const EventPrizesEditor = ({ value = { pool: '', prizes: [] }, onChange, disabled = false }) => {
  const { pool = '', prizes = [] } = value;
  const listed = prizes.filter((p) => p.place.trim() || p.reward.trim()).length;

  const setPrizes = (next) => onChange({ pool, prizes: next });
  const update = (i, prize) => setPrizes(prizes.map((p, j) => (j === i ? prize : p)));
  const remove = (i) => setPrizes(prizes.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= prizes.length) return;
    const next = [...prizes];
    [next[i], next[j]] = [next[j], next[i]];
    setPrizes(next);
  };
  const add = () => {
    if (prizes.length >= MAX_EVENT_PRIZES) { toast.error(`An event lists up to ${MAX_EVENT_PRIZES} prizes.`); return; }
    setPrizes([...prizes, emptyPrize()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="font-bold">
          Prizes <span className="text-muted-foreground font-normal text-xs">(optional — shown above the event videos)</span>
        </Label>
        <span className="text-xs text-muted-foreground tabular-nums">{listed} listed</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Show off what&apos;s on the line: each placing with its payout and photos of the cards that can be won. Put 1st place first.
      </p>

      <div className="space-y-1">
        <Label htmlFor="prize-pool" className="text-xs text-muted-foreground">Total prize pool (optional)</Label>
        <Input
          id="prize-pool"
          value={pool}
          onChange={(e) => onChange({ pool: e.target.value.slice(0, MAX_PRIZE_POOL_CHARS), prizes })}
          placeholder="e.g. $5,000 USD + participation tournament packs"
          maxLength={MAX_PRIZE_POOL_CHARS}
          disabled={disabled}
          className="h-9"
        />
      </div>

      {prizes.map((prize, i) => (
        <PrizeRow
          key={i}
          prize={prize}
          index={i}
          count={prizes.length}
          disabled={disabled}
          onChange={(next) => update(i, next)}
          onRemove={() => remove(i)}
          onMove={(dir) => move(i, dir)}
        />
      ))}

      <Button
        type="button" variant="outline" size="sm" onClick={add}
        disabled={disabled || prizes.length >= MAX_EVENT_PRIZES}
        className="gap-1.5"
      >
        <Plus className="w-4 h-4" aria-hidden="true" /> {prizes.length ? 'Add another prize' : 'Add a prize'}
      </Button>
    </div>
  );
};

export default EventPrizesEditor;
