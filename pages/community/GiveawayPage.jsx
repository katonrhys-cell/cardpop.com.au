import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Gift, Instagram, UserPlus, CheckCircle2, Loader2, Trophy, Clock, Users } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import {
  AU_STATES, giveawayPhase, isAustralianPostcode, isValidInstagramHandle, normaliseInstagramHandle,
} from '@/utils/giveaway.js';

// /giveaway (the current one) and /giveaways/:slug — docs/giveaways.md.
//
// The Instagram post is the front door; this page is the entry register. It
// shows the prizes, the rules and the terms to anyone, and takes an entry only
// from a signed-in member with a confirmed email (the DB trigger enforces the
// same, this page just says so before the form).

const fmtWhen = (iso) => (iso
  ? new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney', timeZoneName: 'short' })
  : '');

const PHASE_BADGE = {
  upcoming: { label: 'Opens soon', cls: 'border-amber-400/50 text-amber-700 dark:text-amber-400' },
  open: { label: 'Entries open', cls: 'border-emerald-400/50 text-emerald-700 dark:text-emerald-400' },
  closed: { label: 'Entries closed', cls: 'border-border text-muted-foreground' },
  drawn: { label: 'Winner drawn', cls: 'border-primary/50 text-primary' },
};

const EMPTY_FORM = { instagramHandle: '', prizeKey: '', state: '', postcode: '', residentConfirmed: false, ageConfirmed: false, newsletterOptIn: true, company: '' };

const PrizeTile = ({ prize, selectable, selected, onSelect }) => {
  const inner = (
    <>
      {prize.image_url ? (
        <img src={prize.image_url} alt={prize.label} loading="lazy" className="w-full aspect-[5/7] object-cover rounded-lg bg-muted" />
      ) : (
        <div className="w-full aspect-[5/7] rounded-lg bg-gradient-to-br from-brand-charcoal to-black flex items-center justify-center">
          <Gift className="w-8 h-8 text-brand-red" />
        </div>
      )}
      <div className="mt-3">
        <p className="font-bold leading-tight">{prize.label}</p>
        {prize.detail && <p className="text-xs text-muted-foreground mt-1">{prize.detail}</p>}
      </div>
    </>
  );
  if (!selectable) return <div className="rounded-xl border border-border bg-card p-3">{inner}</div>;
  return (
    <button
      type="button"
      onClick={() => onSelect(prize.key)}
      aria-pressed={selected}
      className={`text-left rounded-xl border-2 bg-card p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`}
    >
      {inner}
      <p className={`mt-2 text-xs font-semibold uppercase tracking-wider ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
        {selected ? 'Your pick' : 'Pick this card'}
      </p>
    </button>
  );
};

const GiveawayPage = () => {
  const { slug } = useParams();
  const location = useLocation();
  const { isAuthenticated, isEmailVerified, profile, loading: authLoading } = useAuth();

  const [data, setData] = useState(null); // { giveaway, phase, entryCount, myEntry, winner } | { giveaway: null }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiServerClient.fetch(slug ? `/giveaways/${slug}` : '/giveaways/current');
      if (res.status === 404) { setData({ giveaway: null }); return; }
      if (!res.ok) throw new Error('Could not load the giveaway');
      setData(await res.json());
    } catch (err) {
      setError(err.message || 'Could not load the giveaway');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load, isAuthenticated]);

  // Pre-fill the state from the profile once, keep whatever the member typed.
  useEffect(() => {
    const st = String(profile?.location_state || '').toUpperCase();
    if (AU_STATES.includes(st)) setForm((f) => (f.state ? f : { ...f, state: st }));
  }, [profile?.location_state]);

  const giveaway = data?.giveaway || null;
  const phase = useMemo(() => (giveaway ? giveawayPhase(giveaway) : 'hidden'), [giveaway]);
  const prizes = Array.isArray(giveaway?.prizes) ? giveaway.prizes : [];
  const pickMode = giveaway?.entry_mode === 'pick_prize';
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const errs = {};
    if (!isValidInstagramHandle(form.instagramHandle)) errs.instagramHandle = 'Enter your Instagram username (letters, numbers, dots and underscores)';
    if (pickMode && !form.prizeKey) errs.prizeKey = 'Pick the card you want';
    if (!AU_STATES.includes(form.state)) errs.state = 'Pick your state or territory';
    if (!isAustralianPostcode(form.postcode)) errs.postcode = 'Enter your 4-digit postcode';
    if (!form.residentConfirmed) errs.residentConfirmed = 'Required';
    if (!form.ageConfirmed) errs.ageConfirmed = 'Required';
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      const res = await apiServerClient.fetch(`/giveaways/${giveaway.slug}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagramHandle: normaliseInstagramHandle(form.instagramHandle),
          prizeKey: pickMode ? form.prizeKey : null,
          state: form.state,
          postcode: form.postcode.trim(),
          residentConfirmed: true,
          ageConfirmed: true,
          newsletterOptIn: form.newsletterOptIn,
          company: form.company,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body.error || body.issues?.[0]?.message || 'Could not submit your entry';
        throw new Error(msg);
      }
      toast.success("You're in. Good luck!");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const seoTitle = giveaway ? `${giveaway.title} | CardPop Giveaway` : 'Giveaway | CardPop Australia™';
  const canonical = `https://cardpop.com.au${slug ? `/giveaways/${slug}` : '/giveaway'}`;

  const renderEntryBox = () => {
    if (phase === 'drawn') {
      return (
        <Card className="border-primary/40">
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="text-xl font-bold">Winner drawn</h3>
            {data?.winner ? (
              <p className="text-muted-foreground mt-2">
                Congratulations <span className="font-semibold text-foreground">@{data.winner.instagram_handle}</span>
                {data.winner.prize?.label && <> — the {data.winner.prize.label} is yours.</>}
              </p>
            ) : (
              <p className="text-muted-foreground mt-2">The winner has been drawn and contacted.</p>
            )}
            <p className="text-xs text-muted-foreground mt-4">Drawn at random {fmtWhen(giveaway.drawn_at)}. The winner is contacted by email and DM from @cardpop.au only.</p>
          </CardContent>
        </Card>
      );
    }
    if (phase === 'closed') {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-xl font-bold">Entries have closed</h3>
            <p className="text-muted-foreground mt-2">The draw happens next. We'll announce the winner here and on Instagram.</p>
            {data?.myEntry && <p className="text-sm mt-3 text-emerald-700 dark:text-emerald-400 font-medium">Your entry as @{data.myEntry.instagram_handle} is in the draw.</p>}
          </CardContent>
        </Card>
      );
    }
    if (phase === 'upcoming') {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-xl font-bold">Opens {fmtWhen(giveaway.opens_at)}</h3>
            <p className="text-muted-foreground mt-2">Follow @cardpop.au so you don't miss it.</p>
          </CardContent>
        </Card>
      );
    }
    if (data?.myEntry) {
      return (
        <Card className="border-emerald-400/50">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold">You're in</h3>
            <p className="text-muted-foreground mt-2">
              Entered as <span className="font-semibold text-foreground">@{data.myEntry.instagram_handle}</span>
              {pickMode && data.myEntry.prize_key && <> for the <span className="font-semibold text-foreground">{prizes.find((p) => p.key === data.myEntry.prize_key)?.label || data.myEntry.prize_key}</span></>}.
            </p>
            <p className="text-sm text-muted-foreground mt-3">Make sure your comment is under the post. Entries close {fmtWhen(giveaway.closes_at)}.</p>
          </CardContent>
        </Card>
      );
    }
    if (authLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
    if (!isAuthenticated) {
      const next = slug ? `/giveaways/${slug}` : '/giveaway';
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <UserPlus className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="text-xl font-bold">Register to enter</h3>
            <p className="text-muted-foreground mt-2">A free CardPop account is a condition of entry. It takes a minute.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5">
              <Button asChild><Link to={`/signup?next=${encodeURIComponent(next)}`}>Create a free account</Link></Button>
              <Button asChild variant="outline"><Link to="/login" state={{ from: location }}>Sign in</Link></Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (!isEmailVerified) {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-bold">Confirm your email first</h3>
            <p className="text-muted-foreground mt-2">Click the link in the confirmation email we sent, then come back here to enter.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-1">Lock in your entry</h3>
          <p className="text-sm text-muted-foreground mb-5">One entry per person. Use the Instagram account you commented from.</p>
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div>
              <Label htmlFor="ig-handle">Instagram username</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input id="ig-handle" value={form.instagramHandle} onChange={(e) => set('instagramHandle')(e.target.value)} className="pl-8" autoComplete="off" maxLength={31} placeholder="yourhandle" />
              </div>
              {errors.instagramHandle && <p className="text-xs text-destructive mt-1">{errors.instagramHandle}</p>}
            </div>

            {pickMode && (
              <div>
                <Label>The card you want</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                  {prizes.map((p) => (
                    <PrizeTile key={p.key} prize={p} selectable selected={form.prizeKey === p.key} onSelect={set('prizeKey')} />
                  ))}
                </div>
                {errors.prizeKey && <p className="text-xs text-destructive mt-1">{errors.prizeKey}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ga-state">State or territory</Label>
                <Select value={form.state} onValueChange={set('state')}>
                  <SelectTrigger id="ga-state" className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{AU_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                {errors.state && <p className="text-xs text-destructive mt-1">{errors.state}</p>}
              </div>
              <div>
                <Label htmlFor="ga-postcode">Postcode</Label>
                <Input id="ga-postcode" inputMode="numeric" maxLength={4} value={form.postcode} onChange={(e) => set('postcode')(e.target.value.replace(/\D/g, ''))} className="mt-1" placeholder="3032" />
                {errors.postcode && <p className="text-xs text-destructive mt-1">{errors.postcode}</p>}
              </div>
            </div>

            {/* Honeypot: hidden from people, filled by bots. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="ga-company">Company</label>
              <input id="ga-company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => set('company')(e.target.value)} />
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox id="ga-resident" checked={form.residentConfirmed} onCheckedChange={(v) => set('residentConfirmed')(v === true)} className="mt-0.5" />
                <span>I live in Australia and the prize can be posted to an Australian address.{errors.residentConfirmed && <span className="block text-xs text-destructive">Required</span>}</span>
              </label>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox id="ga-age" checked={form.ageConfirmed} onCheckedChange={(v) => set('ageConfirmed')(v === true)} className="mt-0.5" />
                <span>I am {giveaway.min_age || 18} or older and I accept the terms below.{errors.ageConfirmed && <span className="block text-xs text-destructive">Required</span>}</span>
              </label>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox id="ga-news" checked={form.newsletterOptIn} onCheckedChange={(v) => set('newsletterOptIn')(v === true)} className="mt-0.5" />
                <span className="text-muted-foreground">Email me about new pickups, giveaways and card shows. (Optional)</span>
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entering…</> : 'Enter the giveaway'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={giveaway?.description?.slice(0, 160) || 'Enter the current CardPop giveaway. Australian residents, free entry, one random draw.'}
        canonicalUrl={canonical}
        ogImage={giveaway?.image_url || undefined}
      />
      <div className="container-default pt-6">
        <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Community', path: '/community' }, { label: 'Giveaway' }]} />
      </div>

      {loading ? (
        <div className="container-default py-16 space-y-6">
          <Skeleton className="h-12 w-2/3 max-w-lg" />
          <Skeleton className="h-6 w-1/2 max-w-md" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="container-default py-20 text-center">
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button variant="outline" onClick={load}>Try again</Button>
        </div>
      ) : !giveaway ? (
        <div className="container-default py-20 text-center max-w-xl mx-auto">
          <Gift className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">No giveaway running right now</h1>
          <p className="text-muted-foreground">Follow <a className="text-primary font-semibold hover:underline" href="https://www.instagram.com/cardpop.au" target="_blank" rel="noopener noreferrer">@cardpop.au</a> on Instagram to catch the next one.</p>
        </div>
      ) : (
        <>
          <section className="bg-card border-b border-border py-12 md:py-16">
            <div className="container-default grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
              <div className="lg:col-span-3">
                <Badge variant="outline" className={`mb-4 text-xs font-semibold tracking-widest uppercase px-3 py-1 ${PHASE_BADGE[phase]?.cls || ''}`}>
                  {PHASE_BADGE[phase]?.label || 'Giveaway'}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">{giveaway.title}</h1>
                {giveaway.description && <p className="text-lg text-muted-foreground whitespace-pre-line max-w-2xl">{giveaway.description}</p>}
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> {phase === 'upcoming' ? `Opens ${fmtWhen(giveaway.opens_at)}` : `Closes ${fmtWhen(giveaway.closes_at)}`}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" /> {data.entryCount} {data.entryCount === 1 ? 'entry' : 'entries'}</span>
                  {giveaway.instagram_post_url && (
                    <a className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline" href={giveaway.instagram_post_url} target="_blank" rel="noopener noreferrer"><Instagram className="w-4 h-4" /> The post</a>
                  )}
                </div>
              </div>
              {giveaway.image_url && (
                <div className="lg:col-span-2">
                  <img src={giveaway.image_url} alt={giveaway.title} className="w-full max-w-sm mx-auto rounded-2xl shadow-lg" />
                </div>
              )}
            </div>
          </section>

          <div className="container-default py-12 grid grid-cols-1 lg:grid-cols-5 gap-10">
            <div className="lg:col-span-3 space-y-10 min-w-0">
              <section>
                <h2 className="text-2xl font-bold mb-4">{pickMode ? 'The cards on offer' : 'The prize'}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {prizes.map((p) => <PrizeTile key={p.key} prize={p} />)}
                </div>
                {pickMode && <p className="text-sm text-muted-foreground mt-3">Name one when you enter. If you win, that's the card we post to you.</p>}
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">How to enter</h2>
                <ol className="space-y-4">
                  {[
                    ['Follow @cardpop.au on Instagram', 'That is where the winner is announced.'],
                    [pickMode ? 'Comment the surname of the card you want' : 'Comment on the giveaway post', 'Under the giveaway post, from the account you enter with.'],
                    ['Register on CardPop and lock in your entry', 'Free account, Australian residents only, one entry each. The form is on this page.'],
                  ].map(([t, d], i) => (
                    <li key={t} className="flex gap-4">
                      <span className="shrink-0 w-9 h-9 rounded-full bg-brand-red text-white font-extrabold flex items-center justify-center">{i + 1}</span>
                      <div><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
                    </li>
                  ))}
                </ol>
              </section>

              {giveaway.terms && (
                <section>
                  <h2 className="text-2xl font-bold mb-4">Terms and conditions</h2>
                  <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{giveaway.terms}</div>
                </section>
              )}
            </div>

            <aside className="lg:col-span-2 min-w-0">
              <div className="lg:sticky lg:top-24">{renderEntryBox()}</div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};

export default GiveawayPage;
