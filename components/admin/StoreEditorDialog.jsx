import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Trash2, Video } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DIRECTORY_CITIES, STORE_CATEGORY_LABELS } from '@/lib/storeDirectory.js';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { REVIEW_VIDEO_ACCEPT, videoKind } from '@/utils/eventReview.js';
import { uploadStorePhoto, uploadStoreVideo } from '@/utils/uploadStoreMedia.js';
import { MAX_STORE_PHOTOS, MAX_STORE_VIDEOS, normalizeStoreInput, storeSlug } from '@/utils/storePage.js';

const blank = () => ({
  name: '', suburb: '', city: '', address: '', phone: '', website: '', instagram_url: '',
  description: '', opening_hours: '', categories: [], photos: [], videos: [],
});

const fromStore = (store) => ({
  ...blank(),
  ...Object.fromEntries(Object.entries(store || {}).map(([k, v]) => [k, v ?? ''])),
  categories: Array.isArray(store?.categories) ? store.categories : [],
  photos: Array.isArray(store?.photos) ? store.photos : [],
  videos: Array.isArray(store?.videos) ? store.videos : [],
});

const move = (list, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

// Add or edit one card shop's page (Admin → Store Directory). `store` is the
// row being edited, or null to add a new one (created already approved).
// Photos and video clips upload to the admin-only `media` bucket as they are
// picked; nothing reaches the store until Save. `takenSlugs` keeps a new
// store's slug unique. See docs/store-pages.md.
const StoreEditorDialog = ({ open, store, takenSlugs = [], onClose, onSaved }) => {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // 'photos' | 'video' | null
  const [videoLink, setVideoLink] = useState('');
  const photoInput = useRef(null);
  const videoInput = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(store ? fromStore(store) : blank());
    setVideoLink('');
  }, [open, store]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const uploadSlug = store?.slug || storeSlug(form.name, form.suburb || form.city);

  const onPhotoFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_STORE_PHOTOS - form.photos.length;
    if (files.length > room) toast.error(`A shop page holds up to ${MAX_STORE_PHOTOS} photos.`);
    setUploading('photos');
    try {
      for (const file of files.slice(0, Math.max(room, 0))) {
        try {
          const url = await uploadStorePhoto(file, uploadSlug);
          setForm((f) => ({ ...f, photos: [...f.photos, { url, caption: '' }] }));
        } catch (err) {
          toast.error(`${file.name}: ${err.message}`);
        }
      }
    } finally {
      setUploading(null);
    }
  };

  const onVideoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (form.videos.length >= MAX_STORE_VIDEOS) return toast.error(`A shop page holds up to ${MAX_STORE_VIDEOS} videos.`);
    setUploading('video');
    try {
      const { url, poster_url } = await uploadStoreVideo(file, uploadSlug);
      setForm((f) => ({ ...f, videos: [...f.videos, { url, poster_url, caption: '' }] }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
    return undefined;
  };

  const addVideoLink = () => {
    const url = videoLink.trim();
    if (!url) return;
    if (videoKind(url) !== 'embed') return toast.error('Paste a YouTube or Vimeo link.');
    if (form.videos.length >= MAX_STORE_VIDEOS) return toast.error(`A shop page holds up to ${MAX_STORE_VIDEOS} videos.`);
    setForm((f) => ({ ...f, videos: [...f.videos, { url, poster_url: null, caption: '' }] }));
    setVideoLink('');
    return undefined;
  };

  const save = async () => {
    let values;
    try {
      values = normalizeStoreInput({ ...form, state: DIRECTORY_CITIES[form.city]?.state });
    } catch (err) {
      toast.error(err.message);
      return;
    }
    setSaving(true);
    try {
      if (store) {
        const { error } = await supabase
          .from('local_game_stores')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', store.id);
        if (error) throw error;
      } else {
        const base = storeSlug(values.name, values.suburb || values.city);
        const taken = new Set(takenSlugs);
        let slug = base;
        let n = 2;
        while (taken.has(slug)) slug = `${base}-${n++}`;
        const { error } = await supabase
          .from('local_game_stores')
          .insert({ ...values, slug, status: 'approved' });
        if (error) throw error;
      }
      toast.success(`"${values.name}" saved`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || Boolean(uploading);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose?.(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store ? `Edit ${store.name}` : 'Add a store'}</DialogTitle>
          <DialogDescription>
            {store
              ? 'Everything here shows on the shop’s own page in the directory.'
              : 'The store goes live in the directory as soon as you save.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="store-name">Store name</Label>
              <Input id="store-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label>City / region</Label>
              <Select value={form.city} onValueChange={(city) => set({ city })}>
                <SelectTrigger><SelectValue placeholder="Choose a city" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIRECTORY_CITIES).map(([slug, info]) => (
                    <SelectItem key={slug} value={slug}>{info.label}, {info.state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="store-suburb">Suburb</Label>
              <Input id="store-suburb" value={form.suburb} onChange={(e) => set({ suburb: e.target.value })} maxLength={80} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="store-address">Street address</Label>
              <Input id="store-address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="488 La Trobe St, Melbourne VIC" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="store-phone">Phone</Label>
              <Input id="store-phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} />
            </div>
            <div>
              <Label htmlFor="store-website">Website</Label>
              <Input id="store-website" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="store-instagram">Instagram link</Label>
              <Input id="store-instagram" value={form.instagram_url} onChange={(e) => set({ instagram_url: e.target.value })} placeholder="https://www.instagram.com/…" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="store-description">About the shop</Label>
              <Textarea id="store-description" rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={1200} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="store-hours">Opening hours</Label>
              <Textarea
                id="store-hours"
                rows={5}
                value={form.opening_hours}
                onChange={(e) => set({ opening_hours: e.target.value })}
                placeholder={'Monday: Closed\nTuesday to Friday: 11am – 7pm\nSaturday: 10am – 5pm'}
              />
              <p className="text-xs text-muted-foreground mt-1">One line per row, written “Day: hours”.</p>
            </div>
            <div className="sm:col-span-2">
              <Label>What it stocks</Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
                {Object.entries(STORE_CATEGORY_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.categories.includes(key)}
                      onCheckedChange={(on) => set({
                        categories: on ? [...form.categories, key] : form.categories.filter((c) => c !== key),
                      })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold">Photos</h3>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => photoInput.current?.click()}>
                {uploading === 'photos' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
                Add photos
              </Button>
              <span className="text-xs text-muted-foreground">
                {form.photos.length} of {MAX_STORE_PHOTOS} · the first photo is the cover
              </span>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onPhotoFiles} />
            </div>
            {form.photos.length > 0 && (
              <ul className="space-y-2">
                {form.photos.map((photo, i) => (
                  <li key={`${photo.url}-${i}`} className="flex items-center gap-3 rounded-xl border border-border p-2">
                    <img src={toCdnUrl(photo.url)} alt="" className="w-16 h-16 rounded-lg object-cover bg-muted shrink-0" />
                    <Input
                      value={photo.caption || ''}
                      onChange={(e) => set({ photos: form.photos.map((p, j) => (j === i ? { ...p, caption: e.target.value } : p)) })}
                      placeholder="Caption (optional)"
                      maxLength={140}
                      aria-label={`Caption for photo ${i + 1}`}
                    />
                    <div className="flex shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => set({ photos: move(form.photos, i, -1) })} aria-label="Move photo up"><ArrowUp className="w-4 h-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === form.photos.length - 1} onClick={() => set({ photos: move(form.photos, i, 1) })} aria-label="Move photo down"><ArrowDown className="w-4 h-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => set({ photos: form.photos.filter((_, j) => j !== i) })} aria-label="Remove photo"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold">Videos</h3>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => videoInput.current?.click()}>
                {uploading === 'video' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Video className="w-4 h-4 mr-1.5" />}
                Upload a clip
              </Button>
              <span className="text-xs text-muted-foreground">MP4, MOV or WebM up to 50 MB · {form.videos.length} of {MAX_STORE_VIDEOS}</span>
              <input ref={videoInput} type="file" accept={REVIEW_VIDEO_ACCEPT} className="hidden" onChange={onVideoFile} />
            </div>
            <div className="flex gap-2">
              <Input value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="…or paste a YouTube / Vimeo link" aria-label="YouTube or Vimeo link" />
              <Button type="button" variant="outline" onClick={addVideoLink} disabled={!videoLink.trim()}>
                <Link2 className="w-4 h-4 mr-1.5" /> Add
              </Button>
            </div>
            {form.videos.length > 0 && (
              <ul className="space-y-2">
                {form.videos.map((video, i) => (
                  <li key={`${video.url}-${i}`} className="flex items-center gap-3 rounded-xl border border-border p-2">
                    {video.poster_url
                      ? <img src={toCdnUrl(video.poster_url)} alt="" className="w-16 h-16 rounded-lg object-cover bg-muted shrink-0" />
                      : <div className="w-16 h-16 rounded-lg bg-muted shrink-0 flex items-center justify-center"><Video className="w-5 h-5 text-muted-foreground" /></div>}
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        value={video.caption || ''}
                        onChange={(e) => set({ videos: form.videos.map((v, j) => (j === i ? { ...v, caption: e.target.value } : v)) })}
                        placeholder="Caption (optional)"
                        maxLength={140}
                        aria-label={`Caption for video ${i + 1}`}
                      />
                      <p className="text-xs text-muted-foreground truncate">{video.url}</p>
                    </div>
                    <div className="flex shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => set({ videos: move(form.videos, i, -1) })} aria-label="Move video up"><ArrowUp className="w-4 h-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === form.videos.length - 1} onClick={() => set({ videos: move(form.videos, i, 1) })} aria-label="Move video down"><ArrowDown className="w-4 h-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => set({ videos: form.videos.filter((_, j) => j !== i) })} aria-label="Remove video"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {store ? 'Save changes' : 'Add store'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StoreEditorDialog;
