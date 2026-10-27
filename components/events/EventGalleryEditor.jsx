import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const MAX_EVENT_GALLERY_PHOTOS = 24;
const MAX_FILE_BYTES = 20971520;

// Photo gallery picker for the event form. Controlled: `value` is the list of
// photos in display order, each either { url } (already saved) or
// { file, preview } (picked, uploaded when the form is saved). The event page
// shows them below "About this event" (components/reviews/EventReviewGallery.jsx).
const EventGalleryEditor = ({ value = [], onChange, disabled = false }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_EVENT_GALLERY_PHOTOS - value.length;
    const images = files.filter((f) => f.type.startsWith('image/'));
    const sized = images.filter((f) => f.size <= MAX_FILE_BYTES);
    if (images.length < files.length) toast.error('Only images can be added to the gallery.');
    if (sized.length < images.length) toast.error('Photos over 20MB were skipped.');
    if (sized.length > room) toast.error(`A gallery holds up to ${MAX_EVENT_GALLERY_PHOTOS} photos.`);
    const added = sized.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (added.length) onChange([...value, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="font-bold">
          Photo Gallery <span className="text-muted-foreground font-normal text-xs">(optional — shown below "About this event")</span>
        </Label>
        <span className="text-xs text-muted-foreground tabular-nums">{value.length}/{MAX_EVENT_GALLERY_PHOTOS}</span>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-3 transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!disabled) addFiles(e.dataTransfer.files); }}
      >
        {value.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 list-none p-0 m-0 mb-3">
            {value.map((photo, i) => (
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
                    onClick={() => move(i, 1)} disabled={disabled || i === value.length - 1}
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
          disabled={disabled || value.length >= MAX_EVENT_GALLERY_PHOTOS}
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
    </div>
  );
};

export default EventGalleryEditor;
