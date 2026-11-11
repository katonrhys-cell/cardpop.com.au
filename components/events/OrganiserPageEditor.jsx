import React, { useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadEventOrganiserLogo } from '@/utils/uploadEventOrganiserLogo.js';
import { LOGO_ACCEPT, LOGO_MAX_LABEL, logoFileError, isVideoLogoUrl } from '@/utils/eventOrganiserLogo.js';
import { normalizeEventUrl, isValidHttpUrl } from '@/utils/eventFormValidation.js';
import { ORGANISER_PAGE_COLUMNS, MAX_EXTRA_LOGOS } from '@/utils/organiserPage.js';
import { publicImageUrl } from '@/utils/imageUrl.js';

// The organiser's own edit of their public page. RLS lets the page's owner (or
// an admin) update it; the guard trigger in 20261110224209 pins the name, slug
// and owner, so this form never offers them. docs/event-organiser-access.md

const LINKS = [
  ['website_url', 'Website', 'yoursite.com.au'],
  ['instagram_url', 'Instagram', 'instagram.com/yourshow'],
  ['facebook_url', 'Facebook', 'facebook.com/yourshow'],
  ['youtube_url', 'YouTube channel', 'youtube.com/@yourshow'],
];

export default function OrganiserPageEditor({ org, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(() => ({
    description: org.description || '',
    website_url: org.website_url || '',
    instagram_url: org.instagram_url || '',
    facebook_url: org.facebook_url || '',
    youtube_url: org.youtube_url || '',
  }));
  const [logoFile, setLogoFile] = useState(null);
  // Joint organisers: more logos beside the main one. Each item is a saved URL
  // or a newly picked file, kept in display order.
  const savedExtras = Array.isArray(org.extra_logo_urls) ? org.extra_logo_urls : [];
  const [extras, setExtras] = useState(() => savedExtras.map((url) => ({ key: url, url })));
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = logoFileError(file);
    if (problem) { toast.error(problem); e.target.value = ''; return; }
    setLogoFile(file);
  };

  const addExtra = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_EXTRA_LOGOS - extras.length;
    const next = [];
    for (const file of picked.slice(0, Math.max(room, 0))) {
      const problem = logoFileError(file);
      if (problem) { toast.error(problem); continue; }
      next.push({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file });
    }
    if (picked.length > room) toast.error(`A page can show up to ${MAX_EXTRA_LOGOS + 1} logos in all.`);
    if (next.length) setExtras((list) => [...list, ...next]);
  };
  const removeExtra = (key) => setExtras((list) => list.filter((item) => item.key !== key));

  const save = async (e) => {
    e.preventDefault();
    const row = { description: form.description.trim() || null };
    for (const [key, label] of LINKS) {
      const url = normalizeEventUrl(form[key]);
      if (url && !isValidHttpUrl(url)) { toast.error(`${label} isn’t a valid link.`); return; }
      row[key] = url || null;
    }
    setBusy(true);
    try {
      if (logoFile) row.logo_url = await uploadEventOrganiserLogo(logoFile);
      // Only touch the column when the list changed, so a page saved before
      // the migration lands still works.
      const extrasChanged = extras.some((item) => item.file) || extras.length !== savedExtras.length
        || extras.some((item, i) => item.url !== savedExtras[i]);
      if (extrasChanged) {
        row.extra_logo_urls = await Promise.all(extras.map((item) => (item.file ? uploadEventOrganiserLogo(item.file) : item.url)));
      }
      const { data, error } = await supabase
        .from('event_organisers').update(row).eq('id', org.id).select(ORGANISER_PAGE_COLUMNS).maybeSingle();
      if (error) throw error;
      // RLS refusing an update returns no row and no error.
      if (!data) throw new Error('You don’t have permission to edit this page.');
      toast.success('Organiser page updated.');
      onSaved(data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || 'Could not save your changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {org.name}</DialogTitle>
          <DialogDescription>
            What collectors see on your organiser page. The name and web address stay as CardPop confirmed them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-logo" className="text-xs font-bold uppercase tracking-wide">Logo</Label>
            <label htmlFor="org-logo" className="flex items-center gap-2 text-sm cursor-pointer rounded-xl border border-dashed border-border px-3 py-2.5 hover:bg-muted">
              <ImagePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{logoFile ? logoFile.name : 'Choose a new main logo'}</span>
            </label>
            <input id="org-logo" type="file" accept={LOGO_ACCEPT} className="sr-only" onChange={pickLogo} disabled={busy} />
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF or a short MP4/WebM loop, up to {LOGO_MAX_LABEL}.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-extra-logos" className="text-xs font-bold uppercase tracking-wide">More logos (joint organisers)</Label>
            {extras.length > 0 && (
              <ul className="space-y-1.5">
                {extras.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 text-sm">
                    {item.url && !isVideoLogoUrl(item.url) ? (
                      <img src={publicImageUrl(item.url)} alt="" className="w-9 h-9 rounded-md bg-white object-contain border border-border shrink-0" />
                    ) : (
                      <ImagePlus className="w-5 h-5 mx-2 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="truncate flex-1">{item.file ? item.file.name : 'Saved logo'}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeExtra(item.key)} disabled={busy} aria-label="Remove logo">
                      <X className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {extras.length < MAX_EXTRA_LOGOS && (
              <label htmlFor="org-extra-logos" className="flex items-center gap-2 text-sm cursor-pointer rounded-xl border border-dashed border-border px-3 py-2.5 hover:bg-muted">
                <ImagePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Add another logo</span>
              </label>
            )}
            <input id="org-extra-logos" type="file" multiple accept={LOGO_ACCEPT} className="sr-only" onChange={addExtra} disabled={busy} />
            <p className="text-xs text-muted-foreground">Running it with a partner? Add their logo too — each shows beside yours on the page.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-desc" className="text-xs font-bold uppercase tracking-wide">About your events</Label>
            <Textarea id="org-desc" rows={5} maxLength={2000} value={form.description} onChange={set('description')} disabled={busy} placeholder="Who you are, what you run and where." />
            <p className="text-xs text-muted-foreground text-right">{form.description.length}/2000</p>
          </div>
          {LINKS.map(([key, label, placeholder]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`org-${key}`} className="text-xs font-bold uppercase tracking-wide">{label}</Label>
              <Input id={`org-${key}`} inputMode="url" value={form[key]} onChange={set(key)} placeholder={placeholder} disabled={busy} />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="font-bold">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />} Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
