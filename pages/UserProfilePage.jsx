
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Calendar, Save, Edit3, X, ShieldAlert, Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { isVerified } from '@/utils/verification.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { VerificationBadge } from '@/components/VerificationBadge.jsx';

const UserProfilePage = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    display_name: '',
    bio: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchProfile = async () => {
      if (!currentUser) return;
      try {
        const { data: p, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (isMounted) {
          setProfile(p || null);
          if (p) {
            setFormData({
              display_name: p.display_name || '',
              bio: p.bio || ''
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    
    return () => { isMounted = false; };
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Invalid file type. Please upload an image.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error('Image size exceeds 20MB limit.');
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
    if (!formData.display_name.trim()) {
      toast.error('Display name is required.');
      return;
    }

    setSaving(true);
    try {
      const updatePayload = {
        id: currentUser.id,
        display_name: formData.display_name.trim(),
        bio: formData.bio.trim(),
        updated_at: new Date().toISOString()
      };

      if (avatarFile) {
        const compressed = await compressImage(avatarFile, { maxDimension: 512, quality: 0.85 });
        const fileExt = compressed.name.split('.').pop();
        const filePath = `avatars/${currentUser.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        updatePayload.profile_photo_or_character = filePath;
      } else if (removeAvatar) {
        updatePayload.profile_photo_or_character = null;
      }

      let updatedProfile;
      if (profile) {
        const { data, error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', currentUser.id)
          .select()
          .single();
        if (error) throw error;
        updatedProfile = data;
      } else {
        updatePayload.is_verified = false;
        const { data, error } = await supabase
          .from('profiles')
          .insert(updatePayload)
          .select()
          .single();
        if (error) throw error;
        updatedProfile = data;
      }

      setProfile(updatedProfile);
      setIsEditing(false);
      setRemoveAvatar(false);
      setAvatarFile(null);
      toast.success('Public profile updated.');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-8 w-full max-w-4xl mx-auto px-4 py-8">
        <div className="h-48 bg-muted rounded-3xl" />
        <div className="h-64 bg-muted rounded-3xl" />
      </div>
    );
  }

  // Generate fallback UI if public profile doesn't exist
  const isProfileEmpty = !profile && !isEditing;
  const currentPhotoUrl = profile?.profile_photo_or_character
    ? (profile.profile_photo_or_character.startsWith('http')
        ? profile.profile_photo_or_character
        : supabase.storage.from('vault-images').getPublicUrl(profile.profile_photo_or_character).data.publicUrl)
    : null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-16 font-sans">
      <Helmet><title>Public Profile | CardPop</title></Helmet>
      
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-4xl font-bold text-foreground tracking-tight">Public Profile</h1>
          <p className="text-muted-foreground font-medium text-lg mt-1">This is how other collectors see you on CardPop.</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2 rounded-xl h-11 font-bold shadow-sm">
            <Edit3 className="w-4 h-4" /> {profile ? 'Edit Profile' : 'Setup Profile'}
          </Button>
        )}
      </div>

      {!isEditing && profile && profile.is_verified !== 'true' && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 p-4 rounded-2xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">Verification Pending or Not Started</h3>
            <p className="text-sm opacity-90">Verify your identity to build trust with the community and unlock full marketplace features.</p>
          </div>
          <Button asChild className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-none rounded-xl shadow-sm">
            <Link to="/verify-account">Verify Account</Link>
          </Button>
        </div>
      )}

      {isProfileEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border border-dashed rounded-[2rem] shadow-sm">
          <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-2xl font-serif font-bold mb-2">Profile Not Setup</h2>
          <p className="text-muted-foreground mb-6 max-w-md">You haven't created a public profile yet. Set one up to interact in the community marketplace.</p>
          <Button onClick={() => setIsEditing(true)} className="rounded-xl h-12 px-8 font-bold">
            Create Profile
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden mb-8 transition-all">
          <div className="h-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background border-b border-border relative" />
          
          <div className="px-6 sm:px-10 pb-10 relative">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 mb-6">
              <div className="relative group shrink-0 flex flex-col items-center z-10">
                <Avatar className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] border-4 border-card shadow-sm bg-muted text-primary">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} className="object-cover" />
                  ) : (currentPhotoUrl && !removeAvatar) ? (
                    <AvatarImage src={currentPhotoUrl} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="rounded-[2rem] text-4xl font-bold bg-secondary/30">
                    {(profile?.display_name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                {isEditing && (
                  <div className="absolute -bottom-3 flex gap-2">
                    <Label htmlFor="avatar-upload" className="bg-primary text-primary-foreground p-2 rounded-full shadow-md cursor-pointer hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4" />
                      <Input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/jpeg, image/png, image/gif, image/webp" 
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
                )}
              </div>
              
              <div className="flex-1 pb-2 w-full mt-4 sm:mt-0 z-10">
                {isEditing ? (
                  <div className="max-w-md space-y-1 w-full">
                    <Input 
                      name="display_name" 
                      value={formData.display_name} 
                      onChange={handleChange} 
                      className="font-bold text-lg bg-background h-12 rounded-xl focus-visible:ring-primary shadow-sm" 
                      placeholder="Your Display Name" 
                      required 
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight break-all">
                      {profile.display_name}
                    </h2>
                    <VerificationBadge is_verified={profile.is_verified} />
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 mt-8">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">About Me</Label>
                    {isEditing ? (
                      <Textarea 
                        name="bio" 
                        value={formData.bio} 
                        onChange={handleChange} 
                        placeholder="Tell the community about what you collect..." 
                        className="min-h-[140px] resize-none bg-background rounded-xl focus-visible:ring-primary shadow-sm"
                      />
                    ) : (
                      <p className="text-foreground leading-relaxed font-medium">
                        {profile.bio || <span className="text-muted-foreground italic font-normal">No bio provided.</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-muted/30 p-5 rounded-2xl border border-border shadow-sm">
                    <h3 className="font-bold text-foreground mb-4 uppercase text-xs tracking-wider">Collector Stats</h3>
                    <div className="space-y-4">
                      {profile?.created_at && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
                            <Calendar className="w-4 h-4" /> Joined
                          </div>
                          <span className="font-bold text-foreground text-sm">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
                          Verification
                        </div>
                        <span className="font-bold text-foreground text-sm capitalize">
                          {isVerified(profile?.is_verified) ? 'Verified' : profile?.is_verified === 'pending' ? 'Pending' : 'Unverified'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-border">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditing(false);
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setRemoveAvatar(false);
                      if (profile) {
                        setFormData({ display_name: profile.display_name||'', bio: profile.bio||'' });
                      }
                    }}
                    disabled={saving}
                    className="rounded-xl h-11 font-bold w-full sm:w-auto hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="rounded-xl h-11 px-8 font-bold shadow-sm w-full sm:w-auto transition-transform active:scale-95">
                    {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;
