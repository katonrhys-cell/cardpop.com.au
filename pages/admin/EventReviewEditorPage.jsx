import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ClipboardPen, CalendarDays, MapPin, Search, X, ImagePlus, Trash2, ArrowUp, ArrowDown, Plus, Save, Send,
  ExternalLink, Loader2, Sparkles, Camera, ShoppingBag, Star, Eye,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import RichTextEditor from '@/components/admin/RichTextEditor.jsx';
import StarInput from '@/components/admin/StarInput.jsx';
import HalfStars from '@/components/reviews/HalfStars.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { uploadReviewImage } from '@/utils/uploadReviewImage.js';
import { EVENT_REVIEWS_CATEGORY } from '@/data/blogCategories.js';
import {
  SCORE_CATEGORIES,
  CROWD_LEVELS,
  GO_AGAIN_OPTIONS,
  emptyReview,
  computeOverall,
  isValidScore,
  normalizeReview,
  reviewPublishProblems,
  formatAud,
} from '@/utils/eventReview.js';

// Admin → Event Reviews → editor. One page writes two rows: the story is a
// blog_articles row (category `event-reviews`, so it appears in The Parallel
// Report like any article) and the structured parts are an event_reviews row
// (scorecard, quick facts, gallery, pickups) linked to the event. Drafts save
// with anything filled in; publishing needs a title, a body, an event and an
// overall rating. See docs/event-reviews.md.

const slugify = (text) =>
  String(text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const readTimeFromHtml = (html) => {
  const words = String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const parseTags = (s) => Array.from(new Set(String(s || '').split(',').map((t) => t.trim()).filter(Boolean)));

const emptyArticle = () => ({
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  author: '',
  featured_image_url: '',
  tags: '',
  seo_title: '',
  seo_description: '',
  is_published: false,
  featured: false,
  published_at: null,
});

const fmtEventDate = (ev) => {
  if (!ev?.start_date) return 'Date TBA';
  const d = new Date(`${ev.start_date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? 'Date TBA' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtEventPlace = (ev) => [ev?.venue_name, ev?.suburb, ev?.state].filter(Boolean).join(', ') || 'Venue TBA';

const Section = ({ icon: Icon, title, hint, children, id }) => (
  <section id={id} aria-labelledby={`${id}-h`} className="rounded-2xl border border-border bg-card shadow-sm">
    <header className="flex items-start gap-3 border-b border-border px-5 py-4">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </span>
      <div>
        <h2 id={`${id}-h`} className="font-heading text-lg font-bold leading-tight text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </header>
    <div className="px-5 py-5 space-y-5">{children}</div>
  </section>
);

const Chips = ({ options, value, onChange, label }) => (
  <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((o) => {
      const active = value === o.id;
      return (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(active ? null : o.id)}
          title={o.desc}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
            active ? 'border-brand-red bg-brand-red text-white' : 'border-border bg-background text-foreground hover:bg-muted'
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------

const EventReviewEditorPage = () => {
  const { reviewId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, profile } = useAuth();
  const isNew = !reviewId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [article, setArticle] = useState(emptyArticle);
  const [review, setReview] = useState(emptyReview);
  const [event, setEvent] = useState(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [overallOverride, setOverallOverride] = useState(false);

  // Event picker
  const [events, setEvents] = useState([]);
  const [eventQuery, setEventQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const galleryInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const setA = (patch) => setArticle((a) => ({ ...a, ...patch }));
  const setR = (patch) => setReview((r) => ({ ...r, ...patch }));

  // ---- load -------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, slug, title, start_date, end_date, venue_name, suburb, state, image_url, status')
          .order('start_date', { ascending: false })
          .limit(400);
        if (error) throw error;
        if (alive) setEvents(data || []);
      } catch (err) {
        toast.error(err.message || 'Could not load events');
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('event_reviews')
          .select('*, article:blog_articles(*), event:events(id, slug, title, start_date, end_date, venue_name, suburb, state, image_url, status)')
          .eq('id', reviewId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Review not found');
        if (!alive) return;
        const a = data.article || {};
        setArticle({
          id: a.id,
          title: a.title || '',
          slug: a.slug || '',
          excerpt: a.excerpt || '',
          content: a.content || '',
          author: a.author || '',
          featured_image_url: a.featured_image_url || '',
          tags: Array.isArray(a.tags) ? a.tags.join(', ') : '',
          seo_title: a.seo_title || '',
          seo_description: a.seo_description || '',
          is_published: Boolean(a.is_published),
          featured: Boolean(a.featured),
          published_at: a.published_at || null,
        });
        setSlugTouched(true);
        setReview({
          ...emptyReview(),
          event_id: data.event_id,
          attended_on: data.attended_on || null,
          overall_rating: data.overall_rating,
          scores: data.scores || {},
          go_again: data.go_again,
          verdict: data.verdict || '',
          ticket_paid_aud: data.ticket_paid_aud ?? '',
          hours_spent: data.hours_spent ?? '',
          crowd_level: data.crowd_level,
          headline_pickup: data.headline_pickup || '',
          gallery: Array.isArray(data.gallery) ? data.gallery : [],
          pickups: Array.isArray(data.pickups) ? data.pickups : [],
        });
        setOverallOverride(isValidScore(data.overall_rating) && computeOverall(data.scores) !== Number(data.overall_rating));
        setEvent(data.event || null);
      } catch (err) {
        toast.error(err.message || 'Could not load the review');
        navigate('/admin/event-reviews', { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isNew, reviewId, navigate]);

  // New review opened from an event's row: preselect that event.
  const presetEventId = searchParams.get('eventId');
  useEffect(() => {
    if (!isNew || !presetEventId || event || events.length === 0) return;
    const ev = events.find((e) => e.id === presetEventId);
    if (ev) selectEvent(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, presetEventId, events, event]);

  // Default author to the signed-in admin's display name.
  useEffect(() => {
    if (!isNew) return;
    const name = profile?.display_name || profile?.full_name || profile?.username;
    if (name) setArticle((a) => (a.author ? a : { ...a, author: name }));
  }, [isNew, profile]);

  // Close the picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onDown = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  // ---- derived ----------------------------------------------------------
  const autoOverall = useMemo(() => computeOverall(review.scores), [review.scores]);
  const overall = overallOverride ? review.overall_rating : autoOverall;

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    const list = q
      ? events.filter((e) => [e.title, e.venue_name, e.suburb, e.state].filter(Boolean).join(' ').toLowerCase().includes(q))
      : events;
    return list.slice(0, 8);
  }, [events, eventQuery]);

  const publishProblems = reviewPublishProblems({
    article,
    review: { ...review, overall_rating: overall },
  });

  // ---- handlers ---------------------------------------------------------
  function selectEvent(ev) {
    setEvent(ev);
    setPickerOpen(false);
    setEventQuery('');
    setReview((r) => ({ ...r, event_id: ev.id, attended_on: r.attended_on || ev.start_date || null }));
    setArticle((a) => {
      if (a.title) return a;
      const title = `${ev.title}: our review`;
      return { ...a, title, slug: slugTouched ? a.slug : slugify(title) };
    });
  }

  const onTitle = (v) => setArticle((a) => ({ ...a, title: v, slug: slugTouched ? a.slug : slugify(v) }));

  const uploadInto = useCallback((folder) => (file) => uploadReviewImage(file, { folder }), []);

  const onCoverFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadReviewImage(file, { folder: 'covers', maxDimension: 2400 });
      setA({ featured_image_url: url });
      toast.success('Cover photo uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const onGalleryFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const id = toast.loading(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…`);
    let done = 0;
    for (const file of files) {
      try {
        const url = await uploadReviewImage(file, { folder: 'gallery' });
        setReview((r) => ({ ...r, gallery: [...r.gallery, { url, caption: '', alt: '' }] }));
        done += 1;
        toast.loading(`Uploaded ${done} of ${files.length}…`, { id });
      } catch (err) {
        toast.error(`${file.name}: ${err.message || 'upload failed'}`);
      }
    }
    toast.success(`${done} photo${done === 1 ? '' : 's'} added`, { id });
  };

  const updateGallery = (i, patch) => setReview((r) => ({ ...r, gallery: r.gallery.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));
  const moveGallery = (i, dir) => setReview((r) => {
    const g = [...r.gallery]; const j = i + dir;
    if (j < 0 || j >= g.length) return r;
    [g[i], g[j]] = [g[j], g[i]];
    return { ...r, gallery: g };
  });
  const removeGallery = (i) => setReview((r) => ({ ...r, gallery: r.gallery.filter((_, j) => j !== i) }));

  const addPickup = () => setReview((r) => ({ ...r, pickups: [...r.pickups, { name: '', price_aud: '', url: '', image_url: '', note: '' }] }));
  const updatePickup = (i, patch) => setReview((r) => ({ ...r, pickups: r.pickups.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const movePickup = (i, dir) => setReview((r) => {
    const p = [...r.pickups]; const j = i + dir;
    if (j < 0 || j >= p.length) return r;
    [p[i], p[j]] = [p[j], p[i]];
    return { ...r, pickups: p };
  });
  const removePickup = (i) => setReview((r) => ({ ...r, pickups: r.pickups.filter((_, j) => j !== i) }));
  const onPickupPhoto = async (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadReviewImage(file, { folder: 'pickups', maxDimension: 1200 });
      updatePickup(i, { image_url: url });
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const save = async ({ publish }) => {
    if (saving) return;
    const willPublish = publish ?? article.is_published;
    if (willPublish && publishProblems.length) {
      publishProblems.forEach((p) => toast.error(p));
      return;
    }
    if (!article.title.trim()) {
      toast.error('Give the review a title before saving.');
      return;
    }
    setSaving(true);
    try {
      const slug = slugify(article.slug) || slugify(article.title) || `event-review-${Date.now()}`;
      const articlePayload = {
        title: article.title.trim(),
        slug,
        excerpt: article.excerpt.trim() || null,
        content: article.content || null,
        author: article.author.trim() || null,
        category: EVENT_REVIEWS_CATEGORY,
        featured_image_url: article.featured_image_url.trim() || null,
        tags: parseTags(article.tags),
        seo_title: article.seo_title.trim() || null,
        seo_description: article.seo_description.trim() || null,
        featured: Boolean(article.featured),
        is_published: Boolean(willPublish),
        published_at: willPublish ? (article.published_at || new Date().toISOString()) : null,
        read_time_minutes: readTimeFromHtml(article.content),
        conviction_rating: null,
        conviction_type: null,
      };

      let articleId = article.id;
      if (articleId) {
        const { error } = await supabase.from('blog_articles').update(articlePayload).eq('id', articleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('blog_articles')
          .insert({ ...articlePayload, author_id: currentUser?.id })
          .select('id')
          .single();
        if (error) throw error;
        articleId = data.id;
        setA({ id: articleId });
      }

      const reviewRow = {
        ...normalizeReview({ ...review, overall_rating: overall }),
        article_id: articleId,
        author_id: currentUser?.id || null,
      };

      let savedId = reviewId;
      if (savedId) {
        const { error } = await supabase.from('event_reviews').update(reviewRow).eq('id', savedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('event_reviews').insert(reviewRow).select('id').single();
        if (error) throw error;
        savedId = data.id;
      }

      setA({ is_published: Boolean(willPublish), published_at: articlePayload.published_at, slug });
      toast.success(willPublish ? 'Review published' : 'Draft saved');
      if (isNew) navigate(`/admin/event-reviews/${savedId}`, { replace: true });
    } catch (err) {
      const msg = /duplicate key.*slug/i.test(err?.message || '') ? 'That URL slug is already used by another article — change it and save again.' : (err?.message || 'Could not save the review');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const unpublish = () => save({ publish: false });

  // ---- render -----------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const cover = toCdnUrl(article.featured_image_url);

  return (
    <div className="space-y-6 pb-28">
      <Helmet><title>{`${isNew ? 'New event review' : (article.title || 'Edit event review')} — Admin | CardPop`}</title></Helmet>
      <AdminPageHeader
        icon={ClipboardPen}
        title={isNew ? 'Write an event review' : 'Edit event review'}
        subtitle="Rate the day, tell the story, add your photos and pickups. Saved as a draft until you publish."
        backTo="/admin/event-reviews"
      >
        <Badge variant={article.is_published ? 'default' : 'outline'} className={`text-[10px] font-bold uppercase tracking-wider ${article.is_published ? '' : 'border-white/30 text-white'}`}>
          {article.is_published ? 'Published' : 'Draft'}
        </Badge>
        {article.is_published && article.slug && (
          <Button asChild variant="outline" className="rounded-xl h-10 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Link to={`/blog/${article.slug}`} target="_blank" rel="noopener noreferrer"><Eye className="w-4 h-4 mr-1.5" /> View live</Link>
          </Button>
        )}
      </AdminPageHeader>

      {/* ── 1. Event ───────────────────────────────────────────────── */}
      <Section id="ev" icon={CalendarDays} title="Which event?" hint="The review is linked from this event's page once published.">
        {event ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border bg-muted/30 p-3">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
              {event.image_url && <img src={toCdnUrl(event.image_url)} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground leading-snug">{event.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtEventDate(event)}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {fmtEventPlace(event)}</span>
                {event.status && event.status !== 'approved' && <Badge variant="outline" className="text-[10px]">{event.status}</Badge>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="ghost" size="sm" className="rounded-lg">
                <Link to={`/events/${event.slug || event.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-1" /> Event page</Link>
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setEvent(null); setR({ event_id: null }); }}>
                <X className="w-4 h-4 mr-1" /> Change
              </Button>
            </div>
          </div>
        ) : (
          <div ref={pickerRef} className="relative">
            <Label htmlFor="event-search" className="sr-only">Search events</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="event-search"
                value={eventQuery}
                onChange={(e) => { setEventQuery(e.target.value); setPickerOpen(true); }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Search by event name, venue or suburb…"
                className="pl-9 rounded-xl h-11"
                autoComplete="off"
              />
            </div>
            {pickerOpen && (
              <ul className="absolute z-20 mt-1 w-full max-h-80 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg list-none m-0" role="listbox">
                {filteredEvents.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground">
                    No events match. <Link to="/admin/events" className="text-brand-red hover:underline">Add the event first</Link>, then come back.
                  </li>
                ) : filteredEvents.map((ev) => (
                  <li key={ev.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => selectEvent(ev)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted">
                      <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {ev.image_url && <img src={toCdnUrl(ev.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{ev.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{fmtEventDate(ev)} · {fmtEventPlace(ev)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* ── 2. The story ───────────────────────────────────────────── */}
      <Section id="story" icon={ClipboardPen} title="The story" hint="This is the article readers see in The Parallel Report.">
        <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
          <div className="space-y-5 min-w-0">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={article.title} onChange={(e) => onTitle(e.target.value)} placeholder="e.g. Vault Melbourne 2026: the biggest card show we've seen" className="mt-1.5 h-11 rounded-xl text-base font-semibold" />
            </div>
            <div>
              <Label htmlFor="slug">URL</Label>
              <div className="mt-1.5 flex items-center gap-0 rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground whitespace-nowrap">cardpop.com.au/blog/</span>
                <input
                  id="slug"
                  value={article.slug}
                  onChange={(e) => { setSlugTouched(true); setA({ slug: slugify(e.target.value) }); }}
                  className="h-10 flex-1 min-w-0 bg-transparent px-1 text-sm focus:outline-none"
                  placeholder="url-slug"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="excerpt">Standfirst</Label>
              <Textarea id="excerpt" value={article.excerpt} onChange={(e) => setA({ excerpt: e.target.value })} rows={2} placeholder="One or two sentences that sum the day up — shown under the title, on the blog card and in search results." className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="author">Byline</Label>
              <Input id="author" value={article.author} onChange={(e) => setA({ author: e.target.value })} placeholder="Who went?" className="mt-1.5 rounded-xl" />
            </div>
          </div>
          <div>
            <Label>Cover photo</Label>
            <div className="mt-1.5 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
              {cover ? (
                <img src={cover} alt="Cover" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 p-4 text-center">
                  <ImagePlus className="w-6 h-6" aria-hidden="true" /> Your best shot of the day. Used as the hero image, blog card and social preview.
                </div>
              )}
              <div className="flex gap-2 p-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => coverInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4 mr-1" /> {cover ? 'Replace' : 'Upload'}
                </Button>
                {cover && (
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setA({ featured_image_url: '' })} aria-label="Remove cover photo">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverFile} />
            </div>
          </div>
        </div>
        <div>
          <Label>Review</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">Getting there, the floor, the vendors, prices, what you bought, who you met, the verdict. Use section headings so readers can jump around.</p>
          <RichTextEditor value={article.content} onChange={(html) => setA({ content: html })} onUploadImage={uploadInto('body')} />
        </div>
      </Section>

      {/* ── 3. Scorecard ───────────────────────────────────────────── */}
      <Section id="scores" icon={Star} title="Scorecard" hint="Click the left half of a star for a half score. The overall is the average unless you set it yourself.">
        <div className="grid gap-5 md:grid-cols-2">
          {SCORE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-foreground">{cat.label}</p>
              <p className="text-xs text-muted-foreground mb-2">{cat.hint}</p>
              <StarInput label={cat.label} value={review.scores?.[cat.id] ?? null} onChange={(v) => setReview((r) => {
                const scores = { ...(r.scores || {}) };
                if (v == null) delete scores[cat.id]; else scores[cat.id] = v;
                return { ...r, scores };
              })} />
            </div>
          ))}
          <div className="rounded-xl border-2 border-brand-red/40 bg-brand-red/5 p-4 md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Overall</p>
              <p className="text-xs text-muted-foreground">
                {overallOverride ? 'Set by hand.' : autoOverall ? `Average of your ${Object.keys(review.scores || {}).length} score${Object.keys(review.scores || {}).length === 1 ? '' : 's'}.` : 'Score a few categories above, or set it by hand.'}
              </p>
              <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-foreground">
                <Switch checked={overallOverride} onCheckedChange={(on) => { setOverallOverride(on); if (on && !isValidScore(review.overall_rating)) setR({ overall_rating: autoOverall }); }} />
                Set the overall myself
              </label>
            </div>
            <div className="flex items-center gap-3">
              {overallOverride ? (
                <StarInput label="Overall" value={review.overall_rating} onChange={(v) => setR({ overall_rating: v })} size="w-8 h-8" allowClear={false} />
              ) : (
                <>
                  <HalfStars value={overall || 0} size="w-7 h-7" />
                  <span className="font-heading text-3xl font-bold tabular-nums">{overall ? String(overall).replace(/\.0$/, '') : '–'}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label>Would you go again?</Label>
            <div className="mt-2"><Chips label="Would you go again?" options={GO_AGAIN_OPTIONS} value={review.go_again} onChange={(v) => setR({ go_again: v })} /></div>
          </div>
          <div>
            <Label htmlFor="verdict">One-line verdict</Label>
            <Input id="verdict" value={review.verdict} onChange={(e) => setR({ verdict: e.target.value })} maxLength={160} placeholder="e.g. Worth the drive for the vintage tables alone" className="mt-1.5 rounded-xl" />
          </div>
        </div>
      </Section>

      {/* ── 4. Quick facts ─────────────────────────────────────────── */}
      <Section id="facts" icon={Sparkles} title="Quick facts" hint="The at-a-glance panel beside the story. Leave anything blank to hide it.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="attended">Day attended</Label>
            <Input id="attended" type="date" value={review.attended_on || ''} onChange={(e) => setR({ attended_on: e.target.value || null })} className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="ticket">Entry paid (AUD)</Label>
            <Input id="ticket" type="number" min="0" step="0.5" inputMode="decimal" value={review.ticket_paid_aud} onChange={(e) => setR({ ticket_paid_aud: e.target.value })} placeholder="0 = free" className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="hours">Hours on the floor</Label>
            <Input id="hours" type="number" min="0" step="0.5" inputMode="decimal" value={review.hours_spent} onChange={(e) => setR({ hours_spent: e.target.value })} placeholder="e.g. 3.5" className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="headline">Headline pickup</Label>
            <Input id="headline" value={review.headline_pickup} onChange={(e) => setR({ headline_pickup: e.target.value })} maxLength={120} placeholder="The one card of the day" className="mt-1.5 rounded-xl" />
          </div>
        </div>
        <div>
          <Label>How busy was it?</Label>
          <div className="mt-2"><Chips label="Crowd level" options={CROWD_LEVELS} value={review.crowd_level} onChange={(v) => setR({ crowd_level: v })} /></div>
        </div>
      </Section>

      {/* ── 5. Photos ──────────────────────────────────────────────── */}
      <Section id="photos" icon={Camera} title="Photo gallery" hint="Shots from the day, shown as a gallery under the story. The first photo is the biggest tile.">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => galleryInputRef.current?.click()}>
            <ImagePlus className="w-4 h-4 mr-1.5" /> Add photos
          </Button>
          <span className="text-xs text-muted-foreground">{review.gallery.length} photo{review.gallery.length === 1 ? '' : 's'} · compressed in your browser before upload</span>
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onGalleryFiles} />
        </div>
        {review.gallery.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
            {review.gallery.map((g, i) => (
              <li key={`${g.url}-${i}`} className="flex gap-3 rounded-xl border border-border p-3">
                <img src={toCdnUrl(g.url)} alt={g.alt || ''} className="h-24 w-32 shrink-0 rounded-lg object-cover bg-muted" loading="lazy" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input value={g.caption || ''} onChange={(e) => updateGallery(i, { caption: e.target.value })} placeholder="Caption (shown on the photo)" className="h-9 rounded-lg text-sm" aria-label={`Caption for photo ${i + 1}`} />
                  <Input value={g.alt || ''} onChange={(e) => updateGallery(i, { alt: e.target.value })} placeholder="Describe the photo (alt text)" className="h-9 rounded-lg text-sm" aria-label={`Alt text for photo ${i + 1}`} />
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveGallery(i, -1)} disabled={i === 0} aria-label="Move photo up"><ArrowUp className="w-4 h-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveGallery(i, 1)} disabled={i === review.gallery.length - 1} aria-label="Move photo down"><ArrowDown className="w-4 h-4" /></Button>
                    <span className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeGallery(i)} aria-label="Remove photo"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── 6. Pickups ─────────────────────────────────────────────── */}
      <Section id="pickups" icon={ShoppingBag} title="Pickups" hint="What came home with you. Link a pickup to its CardPop listing, price page or shop product if it has one.">
        {review.pickups.length === 0 && <p className="text-sm text-muted-foreground">Nothing listed yet.</p>}
        {review.pickups.length > 0 && (
          <ol className="space-y-3 list-none p-0 m-0">
            {review.pickups.map((p, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <div className="flex gap-3">
                  <label className="relative h-24 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-muted-foreground" title="Photo of the pickup (optional)">
                    {p.image_url ? <img src={toCdnUrl(p.image_url)} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="w-5 h-5" aria-hidden="true" />}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPickupPhoto(i, e)} aria-label={`Photo for pickup ${i + 1}`} />
                  </label>
                  <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-[1fr_8rem]">
                    <Input value={p.name || ''} onChange={(e) => updatePickup(i, { name: e.target.value })} placeholder="What is it? e.g. 1999 Base Set Charizard, PSA 7" className="h-9 rounded-lg text-sm" aria-label={`Pickup ${i + 1} name`} />
                    <Input type="number" min="0" step="0.01" inputMode="decimal" value={p.price_aud ?? ''} onChange={(e) => updatePickup(i, { price_aud: e.target.value })} placeholder="Paid $" className="h-9 rounded-lg text-sm" aria-label={`Pickup ${i + 1} price`} />
                    <Input value={p.url || ''} onChange={(e) => updatePickup(i, { url: e.target.value })} placeholder="Link (optional): /marketplace/… or https://…" className="h-9 rounded-lg text-sm sm:col-span-2" aria-label={`Pickup ${i + 1} link`} />
                    <Input value={p.note || ''} onChange={(e) => updatePickup(i, { note: e.target.value })} placeholder="Note (optional): the table, the deal, why you grabbed it" className="h-9 rounded-lg text-sm sm:col-span-2" aria-label={`Pickup ${i + 1} note`} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePickup(i, -1)} disabled={i === 0} aria-label="Move pickup up"><ArrowUp className="w-4 h-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePickup(i, 1)} disabled={i === review.pickups.length - 1} aria-label="Move pickup down"><ArrowDown className="w-4 h-4" /></Button>
                  {p.image_url && <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => updatePickup(i, { image_url: '' })}>Remove photo</Button>}
                  <span className="flex-1" />
                  {p.price_aud !== '' && p.price_aud != null && Number.isFinite(Number(p.price_aud)) && <span className="text-xs font-bold text-brand-red mr-2">{formatAud(Number(p.price_aud))}</span>}
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePickup(i)} aria-label="Remove pickup"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <Button type="button" variant="outline" className="rounded-xl" onClick={addPickup}><Plus className="w-4 h-4 mr-1.5" /> Add a pickup</Button>
      </Section>

      {/* ── 7. Publishing ──────────────────────────────────────────── */}
      <Section id="publish" icon={Send} title="Publishing" hint="Tags and search settings. Publishing lists the review in The Parallel Report and on the event's page.">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" value={article.tags} onChange={(e) => setA({ tags: e.target.value })} placeholder="card show, melbourne, pokemon (comma-separated)" className="mt-1.5 rounded-xl" />
          </div>
          <div className="flex items-center gap-3 md:pt-7">
            <Switch id="featured" checked={article.featured} onCheckedChange={(v) => setA({ featured: v })} />
            <Label htmlFor="featured" className="cursor-pointer">Feature on the blog home</Label>
          </div>
          <div>
            <Label htmlFor="seo_title">Search title <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="seo_title" value={article.seo_title} onChange={(e) => setA({ seo_title: e.target.value })} maxLength={70} placeholder="Falls back to the title" className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="seo_description">Search description <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="seo_description" value={article.seo_description} onChange={(e) => setA({ seo_description: e.target.value })} maxLength={160} placeholder="Falls back to the standfirst" className="mt-1.5 rounded-xl" />
          </div>
        </div>
        {publishProblems.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-1">Before this can be published:</p>
            <ul className="list-disc pl-5 space-y-0.5">{publishProblems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
      </Section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {article.is_published ? 'Live. Saving keeps it published.' : 'Draft — only admins can see it.'}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => navigate('/admin/event-reviews')} disabled={saving}>Back to list</Button>
            {article.is_published ? (
              <>
                <Button type="button" variant="outline" className="rounded-xl" onClick={unpublish} disabled={saving}>Unpublish</Button>
                <Button type="button" className="rounded-xl font-bold" onClick={() => save({ publish: true })} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Save changes
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => save({ publish: false })} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Save draft
                </Button>
                <Button type="button" className="rounded-xl font-bold" onClick={() => save({ publish: true })} disabled={saving || publishProblems.length > 0} title={publishProblems[0] || 'Publish'}>
                  <Send className="w-4 h-4 mr-1.5" /> Publish
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventReviewEditorPage;
