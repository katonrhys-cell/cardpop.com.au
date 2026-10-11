
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Camera, MapPin, Calendar, Star, Package, TrendingUp, ShieldCheck, Edit2, Save, X, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { compressImage } from '@/utils/compressImage.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VerificationBadge } from '@/components/VerificationBadge.jsx';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';
import { toast } from 'sonner';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { profilePhotoUrl, profilePhotoColumns } from '@/utils/profileAvatar.js';

const VaultProfilePage = () => {
  const { currentUser, isVerified } = useAuth();
  const [profile, setProfile] = useState(null);
  const [vaultCards, setVaultCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedCard, setSelectedCard] = useState(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    location: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fetchProfileAndCards = async () => {
      if (!currentUser) { setLoading(false); return; }
      try {
        const { data: record, error: profileError } = await supabase
          .from('profiles')
          .select(PUBLIC_PROFILE_COLUMNS)
          .eq('id', currentUser.id)
          .single();

        if (profileError) throw profileError;

        if (cancelled) return;
        setProfile(record);
        setFormData({
          name: record.name || '',
          bio: record.bio || '',
          location: record.location_suburb || '',
        });
        if (profilePhotoUrl(record)) {
          const avatarUrl = profilePhotoUrl(record);
          setAvatarPreview(avatarUrl);
        }

        // Fetch user's vault cards
        const { data: cardsData, error: cardsErr } = await supabase
          .from('vault_items')
          .select('*')
          .eq('owner_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(12);
        if (cardsErr) throw cardsErr;

        if (!cancelled) setVaultCards(cardsData || []);

      } catch (error) {
        if (!cancelled) toast.error('Failed to load profile data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfileAndCards();
    return () => { cancelled = true; };
  }, [currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatePayload = {
        name: formData.name,
        bio: formData.bio,
        location_suburb: formData.location,
        updated_at: new Date().toISOString()
      };

      if (avatarFile) {
        const compressed = await compressImage(avatarFile, { maxDimension: 512, quality: 0.85 });
        const fileExt = compressed.name.split('.').pop();
        // Timestamped name (not a fixed per-user path) so the file is
        // immutable and can carry a long-lived cache header.
        const filePath = `avatars/${currentUser.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, compressed, { upsert: true, cacheControl: '31536000' });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('vault-images').getPublicUrl(filePath);
        Object.assign(updatePayload, profilePhotoColumns(urlData.publicUrl));
      }

      const { data: updatedRecord, error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', currentUser.id)
        .select(PUBLIC_PROFILE_COLUMNS)
        .single();

      if (updateError) throw updateError;

      setProfile(updatedRecord);
      setIsEditing(false);
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormData({
      name: profile?.name || '',
      bio: profile?.bio || '',
      location: profile?.location_suburb || '',
    });
    setAvatarFile(null);
    if (profilePhotoUrl(profile)) {
      const avatarUrl = profilePhotoUrl(profile);
      setAvatarPreview(avatarUrl);
    } else {
      setAvatarPreview(null);
    }
  };

  const openCardModal = (card) => {
    setSelectedCard(card);
    setIsCardModalOpen(true);
  };

  if (loading) {
    return (
      <div className="max-w-[90rem] mx-auto px-4 py-12 space-y-8">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-96 md:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const memberSinceDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  const rating = profile?.rating || 0;
  const reviewsCount = profile?.reviews_count || 0;
  const inventoryCount = vaultCards.length;
  const itemsSold = profile?.reviews_count ? Math.floor(profile.reviews_count * 1.5) : 0;
  const positivePercentage = rating ? Math.round((rating / 5) * 100) : 100;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>Vault Profile | CardPop</title>
      </Helmet>

      <div className="h-48 md:h-64 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.2),transparent_50%)]" />
      </div>

      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 -mt-24 relative z-10">
        
        {!isVerified && (
          <div className="mb-6 p-4 bg-muted border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-bold text-foreground">Verify your account to access trading features</h3>
              <p className="text-sm text-muted-foreground">Unverified accounts cannot initiate or accept trades.</p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/verification-pending">Verify Now</Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end mb-8">
                <div className="relative group">
                  <ProfileAvatar
                    profile={profile}
                    size="xl"
                    src={avatarPreview || null}
                    name={formData.name || profile?.email || 'U'}
                  />
                  {isEditing && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      aria-label="Change avatar"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                <div className="flex-1 w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-3xl font-serif font-bold text-foreground">
                        {profile?.name || 'Collector'}
                      </h1>
                      <VerificationBadge is_verified={isVerified} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Joined {memberSinceDate}</span>
                    </div>
                  </div>
                  
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl font-medium">
                      <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button onClick={cancelEdit} variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                      </Button>
                      <Button onClick={handleSave} disabled={saving} className="rounded-xl font-medium bg-primary text-primary-foreground">
                        {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save</>}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input 
                        id="name" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange} 
                        placeholder="Your public name"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input 
                        id="location" 
                        name="location" 
                        value={formData.location} 
                        onChange={handleInputChange} 
                        placeholder="e.g. Melbourne, VIC"
                        className="bg-background"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea 
                      id="bio" 
                      name="bio" 
                      value={formData.bio} 
                      onChange={handleInputChange} 
                      placeholder="Tell the community about your collection..."
                      className="min-h-[120px] bg-background resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {profile?.bio ? (
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No bio provided yet.</p>
                  )}

                  {profile?.location_suburb && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-5 h-5 text-primary" />
                      <span className="font-medium">{profile.location_suburb}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
              <h3 className="font-serif font-bold text-xl text-foreground mb-6">Seller Reputation</h3>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Star className="w-8 h-8 fill-current" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{rating > 0 ? rating.toFixed(1) : 'N/A'}</div>
                  <div className="text-sm text-muted-foreground font-medium">{reviewsCount} Reviews</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Package className="w-5 h-5" />
                    <span className="font-medium">Active Listings</span>
                  </div>
                  <span className="font-bold text-foreground">{inventoryCount}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-medium">Items Sold</span>
                  </div>
                  <span className="font-bold text-foreground">{itemsSold}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-medium">Positive Feedback</span>
                  </div>
                  <span className="font-bold text-emerald-600">{positivePercentage}%</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Vault Inventory Section */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold">My Vault Inventory</h2>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/vault">Manage Vault</Link>
            </Button>
          </div>

          {vaultCards.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-border/50">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold mb-2">Your vault is empty</h3>
              <p className="text-muted-foreground mb-6">Add cards to your vault to start trading and selling.</p>
              <Button asChild>
                <Link to="/vault/add">Add First Card</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {vaultCards.map(card => (
                <div 
                  key={card.id} 
                  className="group relative aspect-[3/4] bg-muted rounded-xl overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openCardModal(card)}
                >
                  {card.card_image ? (
                    <img
                      src={cardThumbUrl(card.card_image)}
                      loading="lazy"
                      alt={card.card_name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    <p className="text-white font-bold text-sm truncate">{card.card_name}</p>
                    <p className="text-white/80 text-xs">{card.condition}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Detail Modal with Carousel */}
      <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card border-border rounded-2xl">
          {selectedCard && (
            <div className="grid grid-cols-1 md:grid-cols-2 h-full max-h-[80vh]">
              <div className="bg-muted/30 p-6 flex items-center justify-center border-r border-border/50">
                <ProductImageCarousel
                  images={selectedCard.card_image}
                  record={selectedCard}
                  className="w-full max-w-sm"
                />
              </div>
              <div className="p-6 flex flex-col overflow-y-auto">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-serif font-bold">{selectedCard.card_name}</DialogTitle>
                  <p className="text-muted-foreground font-medium">{selectedCard.collection}</p>
                </DialogHeader>

                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-3 rounded-xl">
                      <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Condition</p>
                      <p className="font-medium">{selectedCard.condition}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-xl">
                      <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Est. Value</p>
                      <p className="font-medium tabular-nums">
                        ${Number(selectedCard.estimated_value_aud ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-xl">
                      <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Status</p>
                      <p className="font-medium">{selectedCard.listing_type}</p>
                    </div>
                  </div>

                  {selectedCard.notes && (
                    <div className="mt-6">
                      <p className="text-sm font-bold text-foreground mb-2">Notes</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedCard.notes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-border flex gap-3">
                  <Button asChild className="flex-1 rounded-xl font-bold">
                    <Link to={`/product/vault/${selectedCard.id}`}>View Full Details</Link>
                  </Button>
                  <Button variant="outline" onClick={() => setIsCardModalOpen(false)} className="rounded-xl">
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VaultProfilePage;
