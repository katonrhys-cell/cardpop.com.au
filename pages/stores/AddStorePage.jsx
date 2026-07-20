import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Store } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DIRECTORY_CITIES, STORE_CATEGORY_LABELS } from '@/lib/storeDirectory.js';

const schema = z.object({
  name: z.string().trim().min(2, 'Store name is required').max(120),
  suburb: z.string().trim().max(80).optional().or(z.literal('')),
  city: z.string().refine((v) => Boolean(DIRECTORY_CITIES[v]), 'Choose a city/region'),
  website: z.string().trim().url('Enter a full URL, e.g. https://yourstore.com.au')
    .max(300).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').max(200).optional().or(z.literal('')),
  description: z.string().trim().max(500, 'Keep it under 500 characters').optional().or(z.literal('')),
});

const AddStorePage = () => {
  const [categories, setCategories] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', suburb: '', city: '', website: '', email: '', description: '' },
  });
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = form;
  const city = watch('city');

  const toggleCategory = (key) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));

  const onSubmit = async (values) => {
    try {
      const res = await apiServerClient.fetch('/stores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          state: DIRECTORY_CITIES[values.city]?.state,
          categories,
          company: '', // honeypot — humans leave this empty
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Submission failed. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-3xl p-10 text-center max-w-lg">
          <Store className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-3">Thanks — submission received!</h1>
          <p className="text-muted-foreground mb-6">
            We review every listing before it goes live to keep the directory accurate. Your store
            should appear within a few days.
          </p>
          <Link to="/card-shops" className="text-primary font-semibold hover:underline">
            Back to the directory →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Add Your Card Store — Free Listing | CardPop"
        description="List your trading card store in CardPop's free Australian card shop directory and get found by collectors in your city."
        canonicalUrl="/card-shops/add"
      />

      <div className="max-w-2xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 space-y-8">
        <Link to="/card-shops" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to the directory
        </Link>

        <header>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Add your store</h1>
          <p className="text-muted-foreground">
            Free listing in the Australian card shop directory. Submissions are reviewed before
            going live.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-3xl p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Store name *</Label>
            <Input id="name" {...register('name')} placeholder="e.g. Top Deck Cards" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>City / region *</Label>
              <Select value={city} onValueChange={(v) => setValue('city', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Choose a city" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIRECTORY_CITIES).map(([slug, info]) => (
                    <SelectItem key={slug} value={slug}>{info.label} ({info.state})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb</Label>
              <Input id="suburb" {...register('suburb')} placeholder="e.g. Parramatta" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website or social page</Label>
            <Input id="website" {...register('website')} placeholder="https://…" inputMode="url" />
            {errors.website && <p className="text-sm text-destructive">{errors.website.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>What do you sell?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(STORE_CATEGORY_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={categories.includes(key)} onCheckedChange={() => toggleCategory(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Short description</Label>
            <Textarea
              id="description"
              {...register('description')}
              rows={3}
              placeholder="One or two sentences about the store — what you stock, trade nights, grading submissions…"
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Contact email (not published)</Label>
            <Input id="email" {...register('email')} placeholder="you@yourstore.com.au" inputMode="email" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            <p className="text-xs text-muted-foreground">
              Only used if we need to confirm listing details with you.
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting…' : 'Submit for review'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddStorePage;
