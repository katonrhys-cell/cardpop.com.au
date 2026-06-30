import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck, ShieldAlert, Clock, Upload, User, Calendar, MapPin,
  Phone, FileText, Camera, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  none:      { icon: ShieldAlert,  color: 'text-muted-foreground', bg: 'bg-muted',            label: 'Not Verified' },
  pending:   { icon: Clock,        color: 'text-amber-600',        bg: 'bg-amber-500/10',     label: 'Under Review' },
  approved:  { icon: ShieldCheck,  color: 'text-emerald-600',      bg: 'bg-emerald-500/10',   label: 'Verified' },
  rejected:  { icon: ShieldAlert,  color: 'text-destructive',      bg: 'bg-destructive/10',   label: 'Rejected' },
  suspended: { icon: ShieldAlert,  color: 'text-amber-600',        bg: 'bg-amber-500/10',     label: 'Suspended' },
  revoked:   { icon: ShieldAlert,  color: 'text-destructive',      bg: 'bg-destructive/10',   label: 'Revoked' },
};

const FileUploadBox = ({ id, label, icon: Icon, accept, file, preview, onChange, helpText }) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="font-bold text-sm flex items-center gap-1.5">
      <Icon className="w-4 h-4" /> {label}
    </Label>
    <label
      htmlFor={id}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
    >
      {preview ? (
        <img src={preview} alt={label} className="h-32 object-contain rounded-lg mb-2" />
      ) : (
        <>
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Click to upload</p>
        </>
      )}
      {file && <p className="text-xs text-primary font-bold mt-1">{file.name}</p>}
      <input id={id} type="file" accept={accept} className="hidden" onChange={onChange} />
    </label>
    {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
  </div>
);

const AccountVerification = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loadingState, setLoadingState] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullLegalName: '',
    dateOfBirth: '',
    residentialAddress: '',
    phoneNumber: '',
  });
  const [photoIdFile, setPhotoIdFile] = useState(null);
  const [photoIdPreview, setPhotoIdPreview] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);

  const [extracting, setExtracting] = useState(false);
  const [extractedName, setExtractedName] = useState(null);
  const [extractionConfidence, setExtractionConfidence] = useState(null);
  const [nameMatch, setNameMatch] = useState(null); // true | false | null

  useEffect(() => {
    if (!currentUser?.id) { setLoadingState(false); return; }
    let cancelled = false;
    const run = async () => {
      try {
        const [profileRes, verRes] = await Promise.all([
          supabase.from('profiles').select('display_name, username, is_verified, verification_status').eq('id', currentUser.id).single(),
          supabase.from('user_verifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (!cancelled) {
          setProfile(profileRes.data);
          setVerification(verRes.data);
        }
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!extractedName) { setNameMatch(null); return; }
    if (!form.fullLegalName.trim()) { setNameMatch(null); return; }
    const normalize = (s) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
    setNameMatch(normalize(extractedName) === normalize(form.fullLegalName));
  }, [form.fullLegalName, extractedName]);

  const handleFileChange = (setter, previewSetter, isPhotoId = false) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setter(file);
    const reader = new FileReader();
    reader.onloadend = () => previewSetter(reader.result);
    reader.readAsDataURL(file);

    if (isPhotoId) {
      setExtracting(true);
      setExtractedName(null);
      setNameMatch(null);
      try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await apiServerClient.fetch('/id-verification/extract-name', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          setExtractedName(data.extracted_name);
          setExtractionConfidence(data.confidence);
          if (data.extracted_name && form.fullLegalName.trim()) {
            const normalize = (s) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
            setNameMatch(normalize(data.extracted_name) === normalize(form.fullLegalName));
          } else {
            setNameMatch(null);
          }
        }
      } catch {
        // silently fail — extraction is best-effort
      } finally {
        setExtracting(false);
      }
    }
  };

  const uploadFile = async (file, path) => {
    const { error } = await supabase.storage.from('verification-docs').upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullLegalName.trim() || !form.dateOfBirth || !form.residentialAddress.trim() || !form.phoneNumber.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!photoIdFile || !selfieFile) {
      toast.error('Please upload both your photo ID and selfie');
      return;
    }
    setSubmitting(true);
    try {
      const uid = currentUser.id;
      const ts = Date.now();
      const photoIdPath = `${uid}/photo_id_${ts}`;
      const selfiePath = `${uid}/selfie_${ts}`;

      await Promise.all([
        uploadFile(photoIdFile, photoIdPath),
        uploadFile(selfieFile, selfiePath),
      ]);

      const { error } = await supabase.from('user_verifications').insert({
        user_id: uid,
        full_legal_name: form.fullLegalName.trim(),
        date_of_birth: form.dateOfBirth,
        residential_address: form.residentialAddress.trim(),
        phone_number: form.phoneNumber.trim(),
        photo_id_path: photoIdPath,
        selfie_path: selfiePath,
        status: 'pending',
        id_extracted_name: extractedName || null,
        name_match: nameMatch,
        name_match_confidence: extractionConfidence || null,
      });
      if (error) throw error;

      toast.success('Verification submitted! We\'ll review your documents within 1-2 business days.');
      // Reload
      const { data } = await supabase.from('user_verifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setVerification(data);
    } catch (err) {
      toast.error(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingState) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const status = profile?.verification_status || 'none';
  // Fall back to the default config so an unmapped/legacy status value (e.g.
  // 'in_review') can't crash the whole page on statusCfg.icon.
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  const StatusIcon = statusCfg.icon;
  const canApply = status === 'none' || status === 'rejected' || status === 'revoked';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Identity Verification | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Verification' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-1">Identity Verification</h1>
        <p className="text-muted-foreground">Verify your identity to unlock the Verified badge and build buyer/seller trust.</p>
      </div>

      {/* Current status */}
      <div className={`flex items-start gap-4 p-5 rounded-2xl border ${statusCfg.bg}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${statusCfg.bg}`}>
          <StatusIcon className={`w-6 h-6 ${statusCfg.color}`} />
        </div>
        <div className="flex-1">
          <p className={`font-bold text-base ${statusCfg.color}`}>{statusCfg.label}</p>
          {status === 'none' && <p className="text-sm text-muted-foreground mt-0.5">Submit your identity documents to get verified.</p>}
          {status === 'pending' && <p className="text-sm text-muted-foreground mt-0.5">Your documents are under review. We'll notify you within 1–2 business days.</p>}
          {status === 'approved' && <p className="text-sm text-muted-foreground mt-0.5">Your identity has been verified. Your profile displays the Verified badge.</p>}
          {status === 'rejected' && <p className="text-sm text-muted-foreground mt-0.5">{verification?.admin_notes || 'Your verification was rejected. Please resubmit with clearer documents.'}</p>}
          {status === 'suspended' && <p className="text-sm text-muted-foreground mt-0.5">{verification?.admin_notes || 'Your verification has been suspended. Please contact support.'}</p>}
          {status === 'revoked' && <p className="text-sm text-muted-foreground mt-0.5">{verification?.admin_notes || 'Your verified status has been revoked.'}</p>}
          {verification?.additional_info_requested && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs font-bold text-amber-700 mb-1">Additional Information Requested:</p>
              <p className="text-sm text-amber-800">{verification.additional_info_requested}</p>
            </div>
          )}
        </div>
      </div>

      {/* Benefits */}
      {status !== 'approved' && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Why get verified?</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Verified badge on your profile and listings',
              'Increased buyer & seller trust',
              'Badge shown on offers and bids',
              'Access to higher transaction limits',
            ].map(b => (
              <div key={b} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission form */}
      {canApply && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold">Submit Verification</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="font-bold text-sm flex items-center gap-1.5"><User className="w-4 h-4" /> Full Legal Name *</Label>
              <Input id="fullName" value={form.fullLegalName} onChange={e => setForm(p => ({ ...p, fullLegalName: e.target.value }))} placeholder="As it appears on your ID" className="rounded-xl h-11" required />
              {(extracting || extractedName) && (
                <div className={`mt-2 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${
                  extracting ? 'bg-muted text-muted-foreground' :
                  nameMatch === true ? 'bg-emerald-500/10 text-emerald-700' :
                  nameMatch === false ? 'bg-amber-500/10 text-amber-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {extracting ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning ID document…</>
                  ) : nameMatch === true ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Name matches your ID document</>
                  ) : nameMatch === false ? (
                    <><AlertCircle className="w-3.5 h-3.5" /> ID shows "{extractedName}" — please ensure names match</>
                  ) : (
                    <><AlertCircle className="w-3.5 h-3.5" /> Could not read name from ID — please ensure it matches</>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob" className="font-bold text-sm flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Date of Birth *</Label>
              <Input id="dob" type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} className="rounded-xl h-11" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address" className="font-bold text-sm flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Residential Address *</Label>
              <Input id="address" value={form.residentialAddress} onChange={e => setForm(p => ({ ...p, residentialAddress: e.target.value }))} placeholder="Full street address, suburb, state, postcode" className="rounded-xl h-11" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="font-bold text-sm flex items-center gap-1.5"><Phone className="w-4 h-4" /> Mobile Number *</Label>
              <Input id="phone" type="tel" value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="+61 4XX XXX XXX" className="rounded-xl h-11" required />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <FileUploadBox
              id="photoId"
              label="Government Photo ID *"
              icon={FileText}
              accept="image/*,.pdf"
              file={photoIdFile}
              preview={photoIdPreview}
              onChange={handleFileChange(setPhotoIdFile, setPhotoIdPreview, true)}
              helpText="Passport, driver's licence, or national ID card. Max 10MB."
            />
            <FileUploadBox
              id="selfie"
              label="Selfie Verification *"
              icon={Camera}
              accept="image/*"
              file={selfieFile}
              preview={selfiePreview}
              onChange={handleFileChange(setSelfieFile, setSelfiePreview)}
              helpText="A clear photo of you holding your ID next to your face. Max 10MB."
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Your documents are stored securely and only accessible to authorised CardPop administrators. They will not be shared with third parties.</p>
          </div>

          <Button type="submit" disabled={submitting} className="w-full h-12 font-bold rounded-xl gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Upload className="w-4 h-4" /> Submit Verification</>}
          </Button>
        </form>
      )}
    </div>
  );
};

export default AccountVerification;
