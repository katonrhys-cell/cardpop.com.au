
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Check, FileText, Camera, ShieldCheck, ShoppingBag } from 'lucide-react';

const STEPS = ['Your Profile', 'Legal Details', 'Identity Documents', "You're All Set"];

const ProfileCompletionPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    display_name: '',
    location_suburb: '',
    location_state: '',
    bio: '',
    instagram_url: '',
    whatnot_url: '',
    full_name: '',
    date_of_birth: '',
    phone_number: '',
    address: '',
  });

  useEffect(() => {
    let cancelled = false;

    // Wait for auth to resolve. The wizard writes to the caller's own profile,
    // so it needs a signed-in, email-verified account — not a standalone token
    // (nothing in the app issues one). If not signed in, drop the spinner and
    // let the render show the login prompt; if signed in, confirm the email is
    // verified via the backend before revealing the form.
    if (loading) return;
    if (!currentUser) { setVerifying(false); return; }

    const verifyEmail = async () => {
      try {
        const response = await apiServerClient.fetch('/verify-email', { method: 'POST' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Please verify your email address before completing your profile.');
        }
        if (!cancelled) setVerifying(false);
      } catch (err) {
        if (!cancelled) {
          setVerificationError(err.message);
          setVerifying(false);
        }
      }
    };

    verifyEmail();
    return () => { cancelled = true; };
  }, [loading, currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStep1Next = () => {
    if (!formData.display_name.trim()) {
      toast.error('Display name is required.');
      return;
    }
    setStep(2);
  };

  const handleStep2Next = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Full name is required.');
      return;
    }
    if (!formData.date_of_birth) {
      toast.error('Date of birth is required.');
      return;
    }
    if (!formData.phone_number.trim()) {
      toast.error('Phone number is required.');
      return;
    }
    if (!formData.address.trim()) {
      toast.error('Address is required.');
      return;
    }

    if (!currentUser) {
      toast.error('Please log in to complete your profile.');
      navigate('/login', { state: { from: { pathname: `/complete-profile/${token}` } } });
      return;
    }

    setSaving(true);
    try {
      const existingSocials = currentUser.social_links || {};
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          location_suburb: formData.location_suburb,
          location_state: formData.location_state,
          bio: formData.bio,
          social_links: { ...existingSocials, instagram: formData.instagram_url, whatnot: formData.whatnot_url },
          full_name: formData.full_name,
          date_of_birth: formData.date_of_birth || null,
          phone_number: formData.phone_number,
          address: formData.address,
          verification_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setStep(3);
    } catch (error) {
      toast.error(error.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-muted/10">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-serif font-bold">Verifying your email...</h2>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-muted/10">
        <div className="w-full max-w-md bg-card p-8 text-center border border-border rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-destructive/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold mb-4">Verification Failed</h2>
          <p className="text-muted-foreground mb-8">{verificationError}</p>
          <Button asChild className="w-full h-12 font-bold">
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 py-12 bg-muted/10">
      <Helmet><title>Complete Profile | Card Pop</title></Helmet>

      <div className="w-full max-w-lg bg-card p-8 border border-border rounded-2xl shadow-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, idx) => {
            const stepNum = idx + 1;
            const isComplete = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <React.Fragment key={stepNum}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isComplete ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isComplete ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground mt-1 hidden sm:block max-w-[60px] text-center leading-tight">{label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-5 mx-1 rounded transition-colors ${step > stepNum ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {!currentUser ? (
          <div className="bg-primary/5 border border-primary/20 p-6 rounded-xl text-center">
            <p className="mb-4 font-medium">Please log in to complete your profile setup.</p>
            <Button asChild className="w-full">
              <Link to="/login" state={{ from: { pathname: `/complete-profile/${token}` } }}>
                Log In Now
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Step 1 — Your Profile */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h1 className="font-serif text-2xl font-bold mb-1">Your Profile</h1>
                  <p className="text-muted-foreground text-sm">How the community sees you.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name" className="font-bold">Display Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="e.g. RareCardHunter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_suburb" className="font-bold">Suburb</Label>
                  <Input
                    id="location_suburb"
                    name="location_suburb"
                    value={formData.location_suburb}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="e.g. Bondi"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_state" className="font-bold">State</Label>
                  <Input
                    id="location_state"
                    name="location_state"
                    value={formData.location_state}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="e.g. NSW"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="font-bold">Bio</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="bg-background resize-none min-h-[100px]"
                    placeholder="Tell the community about your collection..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram_url" className="font-bold">Instagram URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="instagram_url"
                    name="instagram_url"
                    value={formData.instagram_url}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="e.g. https://instagram.com/yourhandle"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatnot_url" className="font-bold">Whatnot Channel URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="whatnot_url"
                    name="whatnot_url"
                    value={formData.whatnot_url}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="e.g. https://www.whatnot.com/user/yourname"
                  />
                </div>

                <Button onClick={handleStep1Next} className="w-full h-12 font-bold text-base mt-4">
                  Next <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            )}

            {/* Step 2 — Legal Details */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h1 className="font-serif text-2xl font-bold mb-1">Legal Details</h1>
                  <p className="text-muted-foreground text-sm">Required for identity verification.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="font-bold">Full Name <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Must match your government-issued ID</p>
                  <Input
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="e.g. Maya Chen"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth" className="font-bold">Date of Birth <span className="text-destructive">*</span></Label>
                  <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="bg-background"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number" className="font-bold">Phone Number <span className="text-destructive">*</span></Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    type="tel"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="+61 4XX XXX XXX"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold">Address <span className="text-destructive">*</span></Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="bg-background"
                    placeholder="123 Main St, Suburb, State, Postcode"
                    disabled={saving}
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="h-12 font-bold flex-1" disabled={saving}>
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                  </Button>
                  <Button onClick={handleStep2Next} className="h-12 font-bold flex-1" disabled={saving}>
                    {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    {saving ? 'Saving...' : <><span>Next</span> <ChevronRight className="w-5 h-5 ml-1" /></>}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 — Identity Documents */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h1 className="font-serif text-2xl font-bold mb-1">Identity Documents</h1>
                  <p className="text-muted-foreground text-sm">Required to unlock selling and trading features.</p>
                </div>

                <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3 items-start">
                  <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-0.5">Photo ID</p>
                    <p className="text-xs text-muted-foreground">Passport, driver's licence, or government-issued ID. Must clearly show your name and date of birth.</p>
                  </div>
                </div>

                <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3 items-start">
                  <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-0.5">Selfie with ID</p>
                    <p className="text-xs text-muted-foreground">A clear photo of you holding your ID next to your face. Both must be clearly visible.</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Verification is handled securely by Stripe — you can do it now or later from your account. You need verification to Sell, Trade, or use the Vault.</p>

                <Button asChild className="w-full h-12 font-bold">
                  <Link to="/verify-identity">Verify Identity Now</Link>
                </Button>

                <Button variant="ghost" onClick={() => setStep(4)} className="w-full h-10 font-medium text-muted-foreground hover:text-foreground">
                  Skip for now
                </Button>
              </div>
            )}

            {/* Step 4 — You're All Set */}
            {step === 4 && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-green-500/10 mx-auto rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h1 className="font-serif text-2xl font-bold mb-2">You're All Set!</h1>
                  <p className="text-muted-foreground text-sm">Your profile has been saved. Here's what you can do now.</p>
                </div>

                <div className="text-left space-y-3">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <p className="font-bold text-sm text-green-700 dark:text-green-400 mb-2">Available now</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600 shrink-0" /> Browse the marketplace</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600 shrink-0" /> Buy cards &amp; sealed boxes</li>
                    </ul>
                  </div>

                  <div className="bg-muted/40 border border-border rounded-xl p-4">
                    <p className="font-bold text-sm text-muted-foreground mb-2">Requires identity verification</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>Sell items</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>Trade with other collectors</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>Access the Vault</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Button asChild className="w-full h-12 font-bold text-base">
                  <Link to="/account">
                    <ShoppingBag className="w-5 h-5 mr-2" /> Go to My Account
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileCompletionPage;
