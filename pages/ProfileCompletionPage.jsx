
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const ProfileCompletionPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isMounted = useRef(true);
  
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    address: '',
    phoneNumber: ''
  });

  useEffect(() => {
    isMounted.current = true;
    const verifyToken = async () => {
      try {
        const response = await apiServerClient.fetch('/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Invalid or expired token');
        }

        if (isMounted.current) setVerifying(false);
      } catch (err) {
        console.error('Verification error:', err);
        if (isMounted.current) {
          setVerificationError(err.message);
          setVerifying(false);
        }
      }
    };

    if (token) {
      verifyToken();
    } else {
      setVerificationError('No verification token provided.');
      setVerifying(false);
    }
    return () => { isMounted.current = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('Please log in to complete your profile.');
      navigate('/login', { state: { from: { pathname: `/complete-profile/${token}` } } });
      return;
    }

    if (!formData.fullName.trim()) {
      toast.error('Full Name is required.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          date_of_birth: formData.dateOfBirth || null,
          address: formData.address,
          phone_number: formData.phoneNumber,
          verification_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      toast.success('Profile completed! Your verification is now pending review.');
      navigate('/account');
    } catch (error) {
      console.error('Profile update error:', error);
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
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-500/10 mx-auto rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="font-serif text-3xl font-bold mb-2">Email Verified!</h1>
          <p className="text-muted-foreground">Complete your profile to submit for full verification.</p>
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="font-bold">Full Legal Name <span className="text-destructive">*</span></Label>
              <Input 
                id="fullName" 
                required 
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="bg-background"
                placeholder="e.g. Maya Chen"
                disabled={saving}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="font-bold">Date of Birth</Label>
              <Input 
                id="dateOfBirth" 
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                className="bg-background"
                disabled={saving}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="font-bold">Phone Number</Label>
              <Input 
                id="phoneNumber" 
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                className="bg-background"
                placeholder="+1 (555) 000-0000"
                disabled={saving}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address" className="font-bold">Full Address</Label>
              <Input 
                id="address" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="bg-background"
                placeholder="123 Main St, City, State, Zip"
                disabled={saving}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 font-bold text-base mt-6" 
              disabled={saving}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {saving ? 'Submitting...' : 'Submit Profile for Verification'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileCompletionPage;
