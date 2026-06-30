
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck, Upload, ArrowRight, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const VerificationSubmissionPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingStatus, setExistingStatus] = useState(null);
  const [step, setStep] = useState(1);

  // Form Data
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [idPhoto, setIdPhoto] = useState(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const checkExisting = async () => {
      if (!currentUser) return;
      try {
        // user_verification is stubbed — check profiles table for verification_status
        const { data: profileData } = await supabase
          .from('profiles')
          .select('verification_status')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (isMounted && profileData?.verification_status) {
          setExistingStatus(profileData.verification_status);
        }
      } catch (err) {
        // silently ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    checkExisting();
    return () => { isMounted = false; };
  }, [currentUser]);

  const handleIdPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit.');
      return;
    }
    
    setIdPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setIdPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit.');
      return;
    }
    
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfilePhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (!legalName.trim() || !address.trim() || !phone.trim() || !idPhoto) {
      toast.error('Please fill all required fields and upload an ID photo.');
      return;
    }
    
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error('Display name is required for your public profile.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload ID photo to storage
      let idPhotoPath = null;
      if (idPhoto) {
        // Keep IDs large and high quality so details stay legible for review.
        const compressed = await compressImage(idPhoto, { maxDimension: 2200, quality: 0.9 });
        const fileExt = compressed.name.split('.').pop();
        const filePath = `verification/${currentUser.id}/id.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        idPhotoPath = filePath;
      }

      // 2. Upload profile photo if provided
      let profilePhotoPath = null;
      if (profilePhoto) {
        const compressed = await compressImage(profilePhoto, { maxDimension: 512, quality: 0.85 });
        const fileExt = compressed.name.split('.').pop();
        const filePath = `avatars/${currentUser.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        profilePhotoPath = filePath;
      }

      // 3. Update profiles table with verification data and pending status
      const profileUpdate = {
        display_name: displayName,
        legal_name: legalName,
        address,
        phone_number: phone,
        verification_status: 'pending',
        is_verified: false,
        updated_at: new Date().toISOString()
      };
      if (idPhotoPath) profileUpdate.id_photo = idPhotoPath;
      if (profilePhotoPath) profileUpdate.profile_photo_or_character = profilePhotoPath;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      toast.success('Verification request submitted successfully!');
      setExistingStatus('pending');
    } catch (err) {
      toast.error(err.message || 'Failed to submit verification request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (existingStatus) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <Helmet><title>Verification Status | CardPop</title></Helmet>
        <div className="bg-card border border-border p-10 rounded-3xl shadow-sm flex flex-col items-center">
          {existingStatus === 'approved' ? (
            <>
              <CheckCircle className="w-16 h-16 text-emerald-500 mb-6" />
              <h1 className="text-3xl font-serif font-bold mb-4">Account Verified</h1>
              <p className="text-muted-foreground mb-8">Your account identity has been successfully verified.</p>
            </>
          ) : existingStatus === 'rejected' ? (
            <>
              <ShieldCheck className="w-16 h-16 text-destructive mb-6" />
              <h1 className="text-3xl font-serif font-bold mb-4">Verification Rejected</h1>
              <p className="text-muted-foreground mb-8">Unfortunately, your verification was not approved. Please contact support.</p>
            </>
          ) : (
            <>
              <Clock className="w-16 h-16 text-amber-500 mb-6" />
              <h1 className="text-3xl font-serif font-bold mb-4">Submission Received</h1>
              <p className="text-muted-foreground mb-8">Your verification request is currently pending admin review. We will notify you once processing is complete.</p>
            </>
          )}
          <Button onClick={() => navigate('/profile')} className="rounded-xl font-bold h-12 px-8">
            Return to Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 lg:py-20 font-sans">
      <Helmet><title>Account Verification | CardPop</title></Helmet>
      
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4">Verify Your Identity</h1>
        <p className="text-muted-foreground text-lg text-balance">
          Build trust within the community. Verification protects our marketplace and unlocks advanced seller features.
        </p>
      </div>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        {/* Progress Bar */}
        <div className="flex border-b border-border bg-muted/20">
          <div className={`flex-1 py-4 px-6 text-center text-sm font-bold border-r border-border transition-colors ${step === 1 ? 'text-primary bg-primary/5' : 'text-muted-foreground'}`}>
            1. Legal Documents
          </div>
          <div className={`flex-1 py-4 px-6 text-center text-sm font-bold transition-colors ${step === 2 ? 'text-primary bg-primary/5' : 'text-muted-foreground'}`}>
            2. Public Profile
          </div>
        </div>

        <div className="p-6 md:p-10">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label className="font-bold">Full Legal Name *</Label>
                <Input 
                  value={legalName} 
                  onChange={(e) => setLegalName(e.target.value)} 
                  placeholder="As it appears on your ID" 
                  className="bg-background h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Residential Address *</Label>
                <Input 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  placeholder="Street, City, State, ZIP" 
                  className="bg-background h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Phone Number *</Label>
                <Input 
                  type="tel"
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="+1 (555) 000-0000" 
                  className="bg-background h-12 rounded-xl"
                />
              </div>

              <div className="space-y-3 pt-4">
                <Label className="font-bold">Government Issued ID *</Label>
                <p className="text-xs text-muted-foreground">Upload a clear photo of your Passport, Driver's License, or National ID. (Max 20MB)</p>
                
                <div className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center bg-muted/10 relative hover:bg-muted/30 transition-colors">
                  {idPhotoPreview ? (
                    <div className="w-full flex flex-col items-center">
                      <img src={idPhotoPreview} alt="ID Preview" className="max-h-48 rounded-xl object-contain mb-4" />
                      <Button variant="outline" size="sm" onClick={() => { setIdPhoto(null); setIdPhotoPreview(null); }} className="rounded-full">
                        Remove Photo
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                      <Label htmlFor="id-upload" className="cursor-pointer">
                        <span className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold shadow-sm inline-block">Select Image</span>
                        <Input id="id-upload" type="file" accept="image/jpeg, image/png, image/gif, image/webp" className="hidden" onChange={handleIdPhotoChange} />
                      </Label>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <Button onClick={handleNext} className="h-12 px-8 rounded-xl font-bold">
                  Next Step <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium border border-blue-100 mb-6">
                Your legal identity details are kept strictly private. Set up the public profile that other collectors will see below.
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Public Display Name *</Label>
                <Input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="e.g., VaultHunter99" 
                  className="bg-background h-12 rounded-xl"
                />
              </div>

              <div className="space-y-3 pt-4">
                <Label className="font-bold">Profile Photo or Avatar (Optional)</Label>
                <p className="text-xs text-muted-foreground">Upload a public profile picture. (Max 20MB)</p>
                
                <div className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center bg-muted/10 relative hover:bg-muted/30 transition-colors">
                  {profilePhotoPreview ? (
                    <div className="w-full flex flex-col items-center">
                      <img src={profilePhotoPreview} alt="Profile Preview" className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-background shadow-sm" />
                      <Button variant="outline" size="sm" onClick={() => { setProfilePhoto(null); setProfilePhotoPreview(null); }} className="rounded-full">
                        Remove Photo
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                      <Label htmlFor="profile-upload" className="cursor-pointer">
                        <span className="bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-bold shadow-sm inline-block border border-border">Select Image</span>
                        <Input id="profile-upload" type="file" accept="image/jpeg, image/png, image/gif, image/webp" className="hidden" onChange={handleProfilePhotoChange} />
                      </Label>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} className="h-12 px-6 rounded-xl font-medium">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="h-12 px-8 rounded-xl font-bold shadow-sm">
                  {submitting ? 'Submitting...' : 'Submit Verification'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationSubmissionPage;
