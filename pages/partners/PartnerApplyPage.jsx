import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, BadgeCheck, Clock, Loader2, Store, XCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const PARTNER_TYPES = {
  local_game_store: 'Local game store',
  content_creator: 'Content creator',
  other: 'Community / other',
};

const schema = z.object({
  partnerType: z.string().refine((v) => Boolean(PARTNER_TYPES[v]), 'Choose what best describes you'),
  businessName: z.string().trim().min(2, 'Business or creator name is required').max(120),
  website: z.string().trim().url('Enter a full URL, e.g. https://yourstore.com.au')
    .max(300).optional().or(z.literal('')),
  socials: z.string().trim().max(500).optional().or(z.literal('')),
  abn: z.string().trim().optional().or(z.literal(''))
    .refine((v) => !v || /^\d{11}$/.test(v.replace(/\s/g, '')), 'An ABN is 11 digits'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  preferredCode: z.string().trim().optional().or(z.literal(''))
    .refine((v) => !v || /^[A-Za-z0-9][A-Za-z0-9-]{3,19}$/.test(v), '4–20 characters: letters, numbers and hyphens'),
  pitch: z.string().trim().min(20, 'Tell us a little more — at least 20 characters').max(1500),
});

// The "your application is in" states, keyed by partner status.
const STATUS_VIEWS = {
  pending: {
    icon: Clock,
    title: 'Application received',
    body: 'We review every application personally — you\'ll hear from us soon. Once approved, your code, referral link and earnings will appear on your partner dashboard.',
  },
  approved: {
    icon: BadgeCheck,
    title: 'You\'re already a partner!',
    body: 'Your code and referral stats are waiting on your partner dashboard.',
  },
  rejected: {
    icon: XCircle,
    title: 'Application not approved',
    body: 'Your previous application wasn\'t approved this time. If your store or audience has grown since, get in touch via the contact page and we\'ll take another look.',
  },
};

const PartnerApplyPage = () => {
  const [existing, setExisting] = useState(null); // partner row, once loaded
  const [checking, setChecking] = useState(true);
  const [submittedStatus, setSubmittedStatus] = useState(null);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      partnerType: '', businessName: '', website: '', socials: '',
      abn: '', phone: '', preferredCode: '', pitch: '',
    },
  });
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = form;
  const partnerType = watch('partnerType');

  useEffect(() => {
    let cancelled = false;
    apiServerClient.fetch('/partners/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setExisting(data?.partner || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  // Game stores can link their existing /card-shops directory listing.
  useEffect(() => {
    if (partnerType !== 'local_game_store' || stores.length > 0) return;
    supabase
      .from('local_game_stores')
      .select('id, name, suburb, city, state')
      .eq('status', 'approved')
      .order('name')
      .limit(500)
      .then(({ data }) => setStores(data || []));
  }, [partnerType, stores.length]);

  const onSubmit = async (values) => {
    try {
      const res = await apiServerClient.fetch('/partners/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          localGameStoreId: partnerType === 'local_game_store' ? (storeId || '') : '',
          company: '', // honeypot — humans leave this empty
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmittedStatus(data.status || 'pending');
    } catch (err) {
      toast.error(err.message || 'Submission failed. Please try again.');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusView = STATUS_VIEWS[submittedStatus || existing?.status];
  if (statusView) {
    const Icon = statusView.icon;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-3xl p-10 text-center max-w-lg">
          <Icon className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">{statusView.title}</h1>
          <p className="text-muted-foreground mb-6">{statusView.body}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/account/partner" className="text-primary font-semibold hover:underline">
              Go to your partner dashboard →
            </Link>
            <Link to="/partners" className="text-muted-foreground font-semibold hover:underline">
              About the program
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Apply as Partner | CardPop Retailer Network"
        description="Apply to join the CardPop partner program — earn commission and give your audience a discount with your own referral code."
        canonicalUrl="/partners/apply"
      />

      <div className="container-default py-10 space-y-8">
        <Link to="/partners" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> About the partner program
        </Link>

        <header>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Apply as Partner</h1>
          <p className="text-muted-foreground">
            Tell us about your store or audience. We review every application personally
            and reply with your code, discount and commission rates.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-3xl p-6 space-y-5">
          <div className="space-y-2">
            <Label>What best describes you? *</Label>
            <Select value={partnerType} onValueChange={(v) => setValue('partnerType', v, { shouldValidate: true })}>
              <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARTNER_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.partnerType && <p className="text-sm text-destructive">{errors.partnerType.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName">Business or creator name *</Label>
            <Input id="businessName" {...register('businessName')} placeholder="e.g. Top Deck Cards / PullRatePete" />
            {errors.businessName && <p className="text-sm text-destructive">{errors.businessName.message}</p>}
          </div>

          {partnerType === 'local_game_store' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Store className="w-4 h-4" /> Your listing in our card-shops directory</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Optional — pick your store if it's listed" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {[s.suburb, s.city, s.state].filter(Boolean).join(', ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Not listed yet? <Link to="/card-shops/add" className="text-primary hover:underline">Add your store</Link> — or leave this blank and we'll sort it at approval.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" {...register('website')} placeholder="https://…" inputMode="url" />
              {errors.website && <p className="text-sm text-destructive">{errors.website.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Contact phone</Label>
              <Input id="phone" {...register('phone')} placeholder="04xx xxx xxx" inputMode="tel" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="socials">Social channels</Label>
            <Textarea
              id="socials"
              {...register('socials')}
              rows={2}
              placeholder="YouTube / TikTok / Instagram / Whatnot links — one per line"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input id="abn" {...register('abn')} placeholder="11 digits (optional for creators)" inputMode="numeric" />
              {errors.abn && <p className="text-sm text-destructive">{errors.abn.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredCode">Preferred code</Label>
              <Input
                id="preferredCode"
                {...register('preferredCode')}
                placeholder="e.g. TOPDECK10"
                className="font-mono uppercase tracking-widest"
                autoComplete="off"
              />
              {errors.preferredCode && <p className="text-sm text-destructive">{errors.preferredCode.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pitch">Tell us about your store or audience *</Label>
            <Textarea
              id="pitch"
              {...register('pitch')}
              rows={4}
              placeholder="Who's your audience, how big is it, and how would you share your code? Store owners: mention your location and weekly events."
            />
            {errors.pitch && <p className="text-sm text-destructive">{errors.pitch.message}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting…' : 'Submit application'}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By applying you agree to our <Link to="/terms" className="hover:underline text-primary">terms</Link>.
            Discount and commission rates are set individually at approval.
          </p>
        </form>
      </div>
    </div>
  );
};

export default PartnerApplyPage;
