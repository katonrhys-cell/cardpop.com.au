
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Save, Upload, Trash2, Eye, ShieldCheck, ShieldAlert } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const AccountProfile = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    looking_for: '',
    location: '',
    is_public: false,
    social_twitter: '',
    social_instagram: ''
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const socials = currentUser.social_links || {};
      setFormData({
        display_name: currentUser.display_name || currentUser.name || '',
        bio: currentUser.bio || '',
        looking_for: currentUser.looking_for || '',
        location: currentUser.location || '',
        is_public: currentUser.is_public || false,
        social_twitter: socials.twitter || '',
        social_instagram: socials.instagram || ''
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
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload a valid image file.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error('Image exceeds 20MB limit.');
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
      const data = new FormData();
      data.append('display_name', formData.display_name.trim());
      data.append('bio', formData.bio.trim());
      data.append('looking_for', formData.looking_for.trim());
      data.append('location', formData.location.trim());
      data.append('is_public', formData.is_public);
      
      const socials = {};
      if (formData.social_twitter) socials.twitter = formData.social_twitter.trim();
      if (formData.social_instagram) socials.instagram = formData.social_instagram.trim();
      data.append('social_links', JSON.stringify(socials));

      if (avatarFile) {
        data.append('profile_photo', avatarFile);
      } else if (removeAvatar) {
        data.append('profile_photo', '');
      }

      await pb.collection('users').update(currentUser.id, data, { $autoCancel: false });
      
      // Update local auth store context to reflect changes immediately
      await pb.collection('users').authRefresh({ $autoCancel: false });
      
      setAvatarFile(null);
      setRemoveAvatar(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const currentPhotoUrl = currentUser?.profile_photo ? pb.files.getUrl(currentUser, currentUser.profile_photo) : null;
  const isVerified = currentUser?.is_verified === 'true' || currentUser?.verified;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <Helmet>
        <title>Public Profile Settings | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Public Profile' }]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight mb-2">Public Profile</h1>
          <p className="text-muted-foreground font-medium">Manage how you appear to the community.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-xl font-bold shadow-sm h-11">
              <Eye className="w-4 h-4 mr-2" /> Preview Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-background rounded-3xl border-border p-0 overflow-hidden">
            <div className="bg-[hsl(var(--profile-bg))] p-8 border-b border-[hsl(var(--section-divider))] flex items-center gap-6">
              <Avatar className="w-24 h-24 rounded-[2rem] border-2 border-card shadow-sm">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} className="object-cover" />
                ) : (currentPhotoUrl && !removeAvatar) ? (
                  <AvatarImage src={currentPhotoUrl} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl font-bold bg-muted text-foreground">
                  {(formData.display_name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-serif font-bold text-foreground">{formData.display_name || 'Anonymous Collector'}</h2>
                  {isVerified && <ShieldCheck className="w-5 h-5 text-[hsl(var(--verified-badge))]" />}
                </div>
                <p className="text-sm text-muted-foreground font-medium">{formData.location || 'Location hidden'}</p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">About</h3>
                <p className="text-foreground text-sm leading-relaxed">{formData.bio || 'No bio provided.'}</p>
              </div>
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Looking For</h3>
                <p className="text-foreground text-sm leading-relaxed">{formData.looking_for || 'Not specified.'}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-[2rem] shadow-sm overflow-hidden">
        
        {/* Visibility Toggle Section */}
        <div className="p-6 sm:p-8 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">Profile Visibility</h3>
            <p className="text-sm text-muted-foreground font-medium">When public, other collectors can view your profile and active listings.</p>
          </div>
          <div className="flex items-center gap-3 bg-background border border-border px-4 py-2 rounded-xl shadow-sm">
            <Label htmlFor="is_public" className="font-bold cursor-pointer text-sm">Public</Label>
            <Switch 
              id="is_public" 
              checked={formData.is_public}
              onCheckedChange={(v) => setFormData(prev => ({...prev, is_public: v}))}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Avatar Upload */}
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="relative group shrink-0 flex flex-col items-center">
              <Avatar className="w-32 h-32 rounded-[2rem] border-2 border-border bg-muted text-foreground">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} className="object-cover" />
                ) : (currentPhotoUrl && !removeAvatar) ? (
                  <AvatarImage src={currentPhotoUrl} className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-[2rem] text-4xl font-bold bg-secondary/30">
                  {(formData.display_name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
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
            
            <div className="flex-1 space-y-2 mt-2">
              <Label className="font-bold text-foreground">Profile Photo</Label>
              <p className="text-sm text-muted-foreground font-medium">Recommended size: 400x400px. JPG, PNG, WEBP. Max 20MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border">
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display_name" className="font-bold text-foreground">Display Name <span className="text-destructive">*</span></Label>
                <Input 
                  id="display_name" 
                  name="display_name" 
                  value={formData.display_name} 
                  onChange={handleChange} 
                  required
                  className="bg-background h-12 rounded-xl text-foreground placeholder:text-muted-foreground font-medium shadow-sm"
                  placeholder="e.g. RareCardHunter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="font-bold text-foreground">Location</Label>
                <Input 
                  id="location" 
                  name="location" 
                  value={formData.location} 
                  onChange={handleChange} 
                  className="bg-background h-12 rounded-xl text-foreground placeholder:text-muted-foreground font-medium shadow-sm"
                  placeholder="e.g. Sydney, Australia"
                />
              </div>

              <div className="space-y-4 p-5 bg-muted/30 rounded-2xl border border-border shadow-sm">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Social Links</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="social_twitter" className="text-xs font-bold text-muted-foreground">Twitter / X Profile URL</Label>
                    <Input 
                      id="social_twitter" 
                      name="social_twitter" 
                      value={formData.social_twitter} 
                      onChange={handleChange} 
                      className="bg-background h-10 rounded-lg text-foreground placeholder:text-muted-foreground text-sm"
                      placeholder="https://twitter.com/username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="social_instagram" className="text-xs font-bold text-muted-foreground">Instagram Profile URL</Label>
                    <Input 
                      id="social_instagram" 
                      name="social_instagram" 
                      value={formData.social_instagram} 
                      onChange={handleChange} 
                      className="bg-background h-10 rounded-lg text-foreground placeholder:text-muted-foreground text-sm"
                      placeholder="https://instagram.com/username"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="bio" className="font-bold text-foreground">About Me</Label>
                <Textarea 
                  id="bio" 
                  name="bio" 
                  value={formData.bio} 
                  onChange={handleChange} 
                  className="bg-background min-h-[140px] resize-none rounded-xl text-foreground placeholder:text-muted-foreground font-medium shadow-sm"
                  placeholder="Tell the community about your collection focus..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="looking_for" className="font-bold text-foreground">What I'm Looking For</Label>
                <Textarea 
                  id="looking_for" 
                  name="looking_for" 
                  value={formData.looking_for} 
                  onChange={handleChange} 
                  className="bg-background min-h-[100px] resize-none rounded-xl text-foreground placeholder:text-muted-foreground font-medium shadow-sm"
                  placeholder="e.g. 1st Edition Charizard, Vintage NBA..."
                />
              </div>
            </div>
            
          </div>

        </div>

        <div className="p-6 border-t border-border bg-muted/10 flex justify-end">
          <Button type="submit" disabled={loading} className="rounded-xl h-12 px-8 font-bold shadow-md active:scale-95 transition-transform">
            {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AccountProfile;
