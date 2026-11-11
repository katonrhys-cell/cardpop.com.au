import React, { useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadEventOrganiserLogo } from '@/utils/uploadEventOrganiserLogo.js';
import { LOGO_ACCEPT, LOGO_MAX_LABEL, logoFileError } from '@/utils/eventOrganiserLogo.js';
import { normalizeEventUrl, isValidHttpUrl } from '@/utils/eventFormValidation.js';
import { ORGANISER_PAGE_COLUMNS } from '@/utils/organiserPage.js';

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
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = logoFileError(file);
    if (problem) { toast.error(problem); e.target.value = ''; return; }
    setLogoFile(file);
  };

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
              <span className="truncate">{logoFile ? logoFile.name : 'Choose a new logo'}</span>
            </label>
            <input id="org-logo" type="file" accept={LOGO_ACCEPT} className="sr-only" onChange={pickLogo} disabled={busy} />
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF or a short MP4/WebM loop, up to {LOGO_MAX_LABEL}.</p>
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
