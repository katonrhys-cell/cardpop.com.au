
import React, { useState, useEffect } from 'react';
import { Save, Upload, Trash2, Eye, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { profilePhotoUrl, profilePhotoColumns } from '@/utils/profileAvatar.js';
import { compressImage } from '@/utils/compressImage.js';
import { AVATAR_MAX_BYTES, checkImageFile, describeUploadError } from '@/utils/storageUploadError.js';
import { isVerified } from '@/utils/verification.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import UploadErrorDialog from '@/components/account/UploadErrorDialog.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const AccountProfile = () => {
  const { currentUser, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    personal_collection: '',
    location_state: '',
    location_suburb: '',
    social_twitter: '',
    social_instagram: '',
    social_whatnot: ''
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  // Why the last save failed — shown in a dialog the user has to dismiss,
  // because a toast reading "new row violates row level security" looked
  // like an image-size problem and vanished before anyone could read it.
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (currentUser) {
      const socials = currentUser.social_links || {};
      setFormData({
        display_name: currentUser.display_name || currentUser.name || '',
        bio: currentUser.bio || '',
        personal_collection: currentUser.personal_collection || '',
        location_state: currentUser.location_state || '',
        location_suburb: currentUser.location_suburb || '',
        social_twitter: socials.twitter || '',
        social_instagram: socials.instagram || '',
        social_whatnot: socials.whatnot || ''
      });
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const problem = checkImageFile(file, { what: 'profile photo' });
      if (problem) {
        setSaveError(problem);
        e.target.value = '';
        return;
      }
      setAvatarFile(file);
      setRemoveAvatar(false);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let avatar_url = currentUser?.avatar_url ?? null;

      if (avatarFile) {
        const compressed = await compressImage(avatarFile, { maxDimension: 512, quality: 0.85 });
        if (compressed.size > AVATAR_MAX_BYTES) {
          // Say so here rather than letting the bucket 413 — same dialog either way.
          setSaveError(describeUploadError({ message: 'The object exceeded the maximum allowed size', statusCode: '413' }, { what: 'profile photo', sizeBytes: compressed.size }));
          return;
        }
        const ext = compressed.name.split('.').pop();
        // Timestamped name (not a fixed per-user path) so the file is
        // immutable and can carry a long-lived cache header. The bucket's
        // INSERT policy admits `avatars/<uid>-…` — keep the two in step
        // (supabase/migrations/20261023231611_fix_avatars_bucket_upload_policy.sql).
        const path = `avatars/${currentUser.id}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true, cacheControl: '31536000' });
        if (uploadErr) {
          setSaveError(describeUploadError(uploadErr, { what: 'profile photo', sizeBytes: compressed.size }));
          return;
        }
        avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      } else if (removeAvatar) {
        avatar_url = null;
      }

      const { error: updateErr } = await supabase.from('profiles').update({
        display_name: formData.display_name,
        bio: formData.bio,
        personal_collection: formData.personal_collection,
        location_state: formData.location_state,
        location_suburb: formData.location_suburb,
        ...profilePhotoColumns(avatar_url),
        social_links: {
          twitter: formData.social_twitter,
          instagram: formData.social_instagram,
          whatnot: formData.social_whatnot,
        },
      }).eq('id', currentUser.id);

      if (updateErr) throw updateErr;

      setAvatarFile(null);
      setRemoveAvatar(false);
      toast.success('Profile updated successfully!');
      // profiles left the realtime publication, so nothing pushes the change
      // back into AuthContext — refresh it so the header/avatar update now.
      Promise.resolve(refetchProfile?.()).catch(() => {});
    } catch (err) {
      setSaveError(describeUploadError(err, { what: 'profile photo' }));
    } finally {
      setLoading(false);
    }
  };

  const currentPhotoUrl = profilePhotoUrl(currentUser);
  const isUserVerified = isVerified(currentUser?.is_verified) || currentUser?.verified;

  return (
    <AccountPageShell
      documentTitle="Public Profile | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Public Profile' }]}
      title="Public Profile"
      description="Manage how you appear to the community."
      actions={
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-xl font-bold shadow-sm h-10 px-4">
              <Eye className="w-4 h-4 mr-2" /> Preview Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-background rounded-3xl border-border p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Profile Preview</DialogTitle>
            </DialogHeader>
            <div className="bg-muted/30 p-8 border-b border-border flex items-center gap-6">
              <ProfileAvatar
                profile={currentUser}
                size="lg"
                src={avatarPreview ?? (removeAvatar ? null : undefined)}
                name={formData.display_name || 'U'}
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold font-serif tracking-tight text-foreground">
                    {formData.display_name || 'Anonymous Collector'}
                  </h2>
                  {isUserVerified && <ShieldCheck className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {[formData.location_suburb, formData.location_state].filter(Boolean).join(', ') || 'Location hidden'}
                </p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              {formData.personal_collection && (
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Personal Collection (PC)</h3>
                  <p className="text-foreground text-sm leading-relaxed">{formData.personal_collection}</p>
                </div>
              )}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">About</h3>
                <p className="text-foreground text-sm leading-relaxed">{formData.bio || 'No bio provided.'}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <UploadErrorDialog error={saveError} onClose={() => setSaveError(null)} />

      {/* ── Profile form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <Card className="shadow-sm overflow-hidden">

          <CardContent className="p-6 sm:p-8 space-y-8">

            {/* Avatar upload */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative group shrink-0 flex flex-col items-center">
                <ProfileAvatar
                  profile={currentUser}
                  size="xl"
                  src={avatarPreview ?? (removeAvatar ? null : undefined)}
                  name={formData.display_name || currentUser?.email || 'U'}
                />

                <div className="absolute -bottom-3 flex gap-2">
                  <Label htmlFor="avatar-upload" className="bg-foreground text-background p-2 rounded-full shadow-md cursor-pointer hover:scale-105 transition-transform">
                    <Upload className="w-4 h-4" />
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </Label>
                  {(avatarPreview || (currentPhotoUrl && !removeAvatar)) && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="bg-destructive text-destructive-foreground p-2 rounded-full shadow-md cursor-pointer hover:scale-105 transition-transform"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-1 mt-2">
                <Label className="font-bold text-foreground">Profile Photo</Label>
                <p className="text-sm text-muted-foreground font-medium">Recommended 400×400px. JPG, PNG or WEBP, up to 20MB — it's resized to 512px before it's stored.</p>
              </div>
            </div>

            {/* Fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border">

              {/* Left column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="display_name" className="font-bold text-foreground">
                    Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleChange}
                    required
                    className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. RareCardHunter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personal_collection" className="font-bold text-foreground">Personal Collection (PC)</Label>
                  <Input
                    id="personal_collection"
                    name="personal_collection"
                    value={formData.personal_collection}
                    onChange={handleChange}
                    className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. Pokémon WOTC Charizards, vintage Yu-Gi-Oh"
                  />
                  <p className="text-xs text-muted-foreground font-medium">What you personally collect. Shown on your public profile so others know what you chase.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_suburb" className="font-bold text-foreground">Suburb</Label>
                  <Input
                    id="location_suburb"
                    name="location_suburb"
                    value={formData.location_suburb}
                    onChange={handleChange}
                    className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. Bondi"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_state" className="font-bold text-foreground">State</Label>
                  <Input
                    id="location_state"
                    name="location_state"
                    value={formData.location_state}
                    onChange={handleChange}
                    className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. NSW"
                  />
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bio" className="font-bold text-foreground">About Me</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="min-h-[200px] resize-none rounded-xl font-medium shadow-sm"
                    placeholder="Tell the community about your collection focus..."
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">Social Links</h3>

                  <div className="space-y-2">
                    <Label htmlFor="social_twitter" className="font-bold text-foreground">Twitter URL</Label>
                    <Input
                      id="social_twitter"
                      name="social_twitter"
                      value={formData.social_twitter}
                      onChange={handleChange}
                      className="h-12 rounded-xl font-medium shadow-sm"
                      placeholder="https://twitter.com/yourhandle"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="social_instagram" className="font-bold text-foreground">Instagram URL</Label>
                    <Input
                      id="social_instagram"
                      name="social_instagram"
                      value={formData.social_instagram}
                      onChange={handleChange}
                      className="h-12 rounded-xl font-medium shadow-sm"
                      placeholder="https://instagram.com/yourhandle"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="social_whatnot" className="font-bold text-foreground">Whatnot Channel URL</Label>
                    <Input
                      id="social_whatnot"
                      name="social_whatnot"
                      value={formData.social_whatnot}
                      onChange={handleChange}
                      className="h-12 rounded-xl font-medium shadow-sm"
                      placeholder="https://www.whatnot.com/user/yourname"
                    />
                  </div>
                </div>
              </div>

            </div>
          </CardContent>

          {/* Save footer */}
          <div className="p-6 border-t border-border bg-muted/10 flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-12 px-8 font-bold shadow-md active:scale-95 transition-transform"
            >
              {loading ? 'Saving…' : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
            </Button>
          </div>

        </Card>
      </form>
    </AccountPageShell>
  );
};

export default AccountProfile;
