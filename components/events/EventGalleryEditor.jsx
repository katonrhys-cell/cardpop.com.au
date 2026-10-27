import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FolderPlus, ImagePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  MAX_EVENT_GALLERY_ALBUMS,
  MAX_EVENT_GALLERY_PHOTOS,
  MAX_ALBUM_TITLE_CHARS,
} from '@/utils/eventGallery.js';

export { MAX_EVENT_GALLERY_PHOTOS };
const MAX_FILE_BYTES = 20971520;

export const emptyAlbum = () => ({ title: '', photos: [] });

// Photo gallery picker for the event form, grouped into albums. Controlled:
// `value` is the list of albums in display order, each
// { title, photos } where a photo is either { url } (already saved) or
// { file, preview } (picked, uploaded when the form is saved). The event page
// shows the albums as chips above one photo grid
// (components/events/EventPhotoAlbums.jsx).
const AlbumEditor = ({ album, index, count, onChange, onRemove, onMove, disabled }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const photos = album.photos;
  const n = index + 1;

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_EVENT_GALLERY_PHOTOS - photos.length;
    const images = files.filter((f) => f.type.startsWith('image/'));
    const sized = images.filter((f) => f.size <= MAX_FILE_BYTES);
    if (images.length < files.length) toast.error('Only images can be added to the gallery.');
    if (sized.length < images.length) toast.error('Photos over 20MB were skipped.');
    if (sized.length > room) toast.error(`An album holds up to ${MAX_EVENT_GALLERY_PHOTOS} photos — add another album for the rest.`);
    const added = sized.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (added.length) onChange({ ...album, photos: [...photos, ...added] });
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (i) => onChange({ ...album, photos: photos.filter((_, j) => j !== i) });
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...album, photos: next });
  };

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-3 transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!disabled) addFiles(e.dataTransfer.files); }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Label htmlFor={`album-title-${n}`} className="sr-only">Album {n} title</Label>
        <Input
          id={`album-title-${n}`}
          value={album.title}
          onChange={(e) => onChange({ ...album, title: e.target.value.slice(0, MAX_ALBUM_TITLE_CHARS) })}
          placeholder={count > 1 || album.title ? `Album title — e.g. ${new Date().getFullYear()}, Day 1, Vendors` : 'Album title (optional) — e.g. 2025'}
          maxLength={MAX_ALBUM_TITLE_CHARS}
          disabled={disabled}
          className="h-9 font-semibold"
        />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{photos.length}/{MAX_EVENT_GALLERY_PHOTOS}</span>
        <div className="flex gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move album ${n} up`}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={`Move album ${n} down`}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove} disabled={disabled} aria-label={`Remove album ${n}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 list-none p-0 m-0 mb-3">
          {photos.map((photo, i) => (
            <li key={photo.url || photo.preview} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted group">
              <img src={photo.preview || photo.url} alt={`Gallery photo ${i + 1}`} className="w-full h-full object-cover" />
              <Button
                type="button" variant="destructive" size="icon"
                className="absolute top-1 right-1 h-7 w-7 rounded-full shadow"
                onClick={() => remove(i)} disabled={disabled}
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
              <div className="absolute bottom-1 left-1 flex gap-1">
                <Button
                  type="button" variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow"
                  onClick={() => move(i, -1)} disabled={disabled || i === 0}
                  aria-label={`Move photo ${i + 1} earlier`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button" variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow"
                  onClick={() => move(i, 1)} disabled={disabled || i === photos.length - 1}
                  aria-label={`Move photo ${i + 1} later`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || photos.length >= MAX_EVENT_GALLERY_PHOTOS}
        className="w-full flex flex-col items-center justify-center py-5 rounded-xl hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ImagePlus className="w-7 h-7 text-muted-foreground mb-1.5" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Add photos — click or drag several at once</span>
        <span className="text-xs text-muted-foreground">Max 20MB each — compressed before upload. The first photo is the biggest tile.</span>
      </button>
      <input
        ref={inputRef} type="file" multiple className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => addFiles(e.target.files)} disabled={disabled}
      />
    </div>
  );
};

const EventGalleryEditor = ({ value = [], onChange, disabled = false }) => {
  const albums = value.length ? value : [emptyAlbum()];
  const total = albums.reduce((sum, a) => sum + a.photos.length, 0);

  const update = (i, album) => onChange(albums.map((a, j) => (j === i ? album : a)));
  const removeAlbum = (i) => {
    const next = albums.filter((_, j) => j !== i);
    onChange(next.length ? next : [emptyAlbum()]);
  };
  const moveAlbum = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= albums.length) return;
    const next = [...albums];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addAlbum = () => {
    if (albums.length >= MAX_EVENT_GALLERY_ALBUMS) { toast.error(`A gallery holds up to ${MAX_EVENT_GALLERY_ALBUMS} albums.`); return; }
    onChange([...albums, emptyAlbum()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="font-bold">
          Photo Gallery <span className="text-muted-foreground font-normal text-xs">(optional — shown below "About this event")</span>
        </Label>
        <span className="text-xs text-muted-foreground tabular-nums">{total} photo{total === 1 ? '' : 's'}</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Group photos into albums — one per year for a recurring show ("2025", "2024"), or by day or theme. Visitors switch between albums on the event page; the first album shows first.
      </p>

      {albums.map((album, i) => (
        <AlbumEditor
          key={i}
          album={album}
          index={i}
          count={albums.length}
          disabled={disabled}
          onChange={(next) => update(i, next)}
          onRemove={() => removeAlbum(i)}
          onMove={(dir) => moveAlbum(i, dir)}
        />
      ))}

      <Button
        type="button" variant="outline" size="sm" onClick={addAlbum}
        disabled={disabled || albums.length >= MAX_EVENT_GALLERY_ALBUMS}
        className="gap-1.5"
      >
        <FolderPlus className="w-4 h-4" aria-hidden="true" /> Add another album
      </Button>
    </div>
  );
};

export default EventGalleryEditor;
