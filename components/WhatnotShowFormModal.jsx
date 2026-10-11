import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { Loader2, ImageIcon, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { toast } from 'sonner';

const EMPTY_FORM = {
  seller_name: '',
  show_title: '',
  description: '',
  show_date: '',
  show_time: '',
  whatnot_url: '',
  whatnot_channel_url: '',
  is_active: true,
};

// Split a stored timestamptz into the date + time strings the inputs expect,
// in the viewer's local zone so a show reads back the way it was entered.
const splitShowDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { show_date: '', show_time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    show_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    show_time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

/**
 * Create/edit form for a Whatnot show listing.
 *
 * Shared by the public directory (/community/whatnot), My Shows
 * (/account/shows) and the admin management page, so all three write the same
 * shape. Pass `show` to edit an existing listing, omit it to create one.
 *
 * Listings are self-serve: saving publishes straight to the public directory.
 * The admin-only moderation columns are handled on the admin page, not here.
 */
const WhatnotShowFormModal = ({ isOpen, onClose, show = null, onSaved }) => {
  const { currentUser } = useAuth();
  const isEditing = Boolean(show?.id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImage, setExistingImage] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch the owner's profile to show who the listing is attributed to, and to
  // seed the seller name on a new listing.
  const ownerId = show?.user_id || currentUser?.id;
  useEffect(() => {
    if (!isOpen || !ownerId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, profile_photo_or_character')
      .eq('id', ownerId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setUserProfile(data);
        setForm(f => (f.seller_name ? f : { ...f, seller_name: data.display_name || data.username || '' }));
      });
    return () => { cancelled = true; };
  }, [isOpen, ownerId]);

  // Reset the form whenever the modal opens, or switches which show it edits.
  useEffect(() => {
    if (!isOpen) return;
    if (show) {
      setForm({
        seller_name:         show.seller_name || '',
        show_title:          show.show_title || '',
        description:         show.description || '',
        whatnot_url:         show.whatnot_url || '',
        whatnot_channel_url: show.whatnot_channel_url || '',
        is_active:           show.is_active !== false,
        ...splitShowDate(show.show_date),
      });
      setExistingImage(show.preview_image_url || null);
    } else {
      setForm(EMPTY_FORM);
      setExistingImage(null);
    }
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOpen, show]);

  // Revoke the previous preview object URL so replacing an image doesn't leak
  // its Blob for the lifetime of the page.
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.seller_name.trim()) { toast.error('Please enter a business or seller name.'); return; }
    if (!form.show_title.trim()) { toast.error('Please enter a show title.'); return; }
    if (!form.show_date || !form.show_time) { toast.error('Please pick a date and time.'); return; }

    const showDatetime = new Date(`${form.show_date}T${form.show_time}`);
    if (Number.isNaN(showDatetime.getTime())) { toast.error('That date and time isn’t valid.'); return; }

    setSubmitting(true);
    try {
      let preview_image_url = existingImage;

      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const ext = compressed.name.split('.').pop();
        // The vault-images INSERT policy is
        //   (storage.foldername(name))[1] = auth.uid()::text
        // so the uploader's id has to be the *first* path segment. The old
        // `whatnot-shows/<uid>/…` ordering put a literal there instead, which
        // failed that check and made every preview-image upload 403.
        const path = `${ownerId}/whatnot-shows/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('vault-images')
          .upload(path, compressed, { upsert: true, cacheControl: '31536000' });
        if (uploadErr) throw uploadErr;
        preview_image_url = supabase.storage.from('vault-images').getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        seller_name:         form.seller_name.trim(),
        show_title:          form.show_title.trim(),
        description:         form.description.trim() || null,
        show_date:           showDatetime.toISOString(),
        whatnot_url:         form.whatnot_url.trim() || null,
        whatnot_channel_url: form.whatnot_channel_url.trim() || null,
        preview_image_url,
        is_active:           form.is_active,
      };

      const { error } = isEditing
        ? await supabase.from('whatnot_shows').update(payload).eq('id', show.id)
        : await supabase.from('whatnot_shows').insert({ ...payload, user_id: ownerId });
      if (error) throw error;

      toast.success(isEditing ? 'Show updated.' : 'Your show is now listed on the Whatnot directory.');
      onSaved?.();
      onClose?.();
    } catch (err) {
      // The whatnot_shows insert policy denies non-Premium members — explain
      // the perk instead of surfacing a raw row-level-security error.
      if (err?.code === '42501' || /row-level security/i.test(err?.message || '')) {
        toast.error('Listing Whatnot shows is a Premium-and-up membership perk. Upgrade your membership to advertise your shows.', { duration: 10000 });
      } else {
        toast.error(err.message || 'Failed to save your show. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, imageFile, existingImage, isEditing, show?.id, ownerId, onSaved, onClose]);

  const previewSrc = imagePreview || (existingImage ? toCdnUrl(existingImage) : null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEditing ? 'Edit Show' : 'List Your Show'}
          </DialogTitle>
          <DialogDescription>
            Shows appear on the{' '}
            <span className="font-medium text-foreground">Community → Whatnot</span> directory as soon as you save.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Listing-as profile card */}
          {userProfile && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-3">
              <ProfileAvatar
                profile={userProfile}
                size="sm"
                name={userProfile.display_name || userProfile.username || 'S'}
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Listing as</p>
                <p className="font-bold text-sm leading-tight truncate">
                  {userProfile.display_name || userProfile.username}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wn_seller_name">Business / Seller Name <span className="text-destructive">*</span></Label>
            <Input
              id="wn_seller_name"
              placeholder="Your business name, sole trader name, or handle"
              value={form.seller_name}
              onChange={e => setForm(f => ({ ...f, seller_name: e.target.value }))}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">This is the name buyers will see on your listing.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wn_show_title">Show Title <span className="text-destructive">*</span></Label>
            <Input
              id="wn_show_title"
              placeholder="e.g. Sunday Night Pokémon Break"
              value={form.show_title}
              onChange={e => setForm(f => ({ ...f, show_title: e.target.value }))}
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wn_show_date">Date <span className="text-destructive">*</span></Label>
              <Input
                id="wn_show_date"
                type="date"
                value={form.show_date}
                onChange={e => setForm(f => ({ ...f, show_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wn_show_time">Time (your local time) <span className="text-destructive">*</span></Label>
              <Input
                id="wn_show_time"
                type="time"
                value={form.show_time}
                onChange={e => setForm(f => ({ ...f, show_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wn_description">Show Description</Label>
            <Textarea
              id="wn_description"
              placeholder="What cards or sets will you be breaking? Any special deals or giveaways?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Show Preview Image</Label>
            {previewSrc ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={previewSrc} alt="Show preview" className="w-full max-h-52 object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-background/90 hover:bg-background rounded-lg p-1.5 transition-colors shadow"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-[#FFDF00]/60 hover:text-yellow-600 dark:hover:text-[#FFDF00] transition-colors cursor-pointer"
              >
                <ImageIcon className="w-8 h-8 opacity-50" />
                <span className="text-sm font-medium">Upload a show preview or promotional image</span>
                <span className="text-xs opacity-70">PNG, JPG — up to 10 MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wn_url">Show / Event Link</Label>
            <Input
              id="wn_url"
              type="url"
              placeholder="https://whatnot.com/live/..."
              value={form.whatnot_url}
              onChange={e => setForm(f => ({ ...f, whatnot_url: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Direct link to this specific show or auction event.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wn_channel_url">Your Whatnot Channel / Profile</Label>
            <Input
              id="wn_channel_url"
              type="url"
              placeholder="https://whatnot.com/user/yourname"
              value={form.whatnot_channel_url}
              onChange={e => setForm(f => ({ ...f, whatnot_channel_url: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Your Whatnot profile so buyers can follow you.</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <Label htmlFor="wn_is_active" className="font-bold">Listed publicly</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Turn this off to keep the show in My Shows without showing it on the directory.
              </p>
            </div>
            <Switch
              id="wn_is_active"
              checked={form.is_active}
              onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl font-bold bg-[#FFDF00] hover:bg-[#FFDF00]/90 text-black"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Publish Show'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WhatnotShowFormModal;
