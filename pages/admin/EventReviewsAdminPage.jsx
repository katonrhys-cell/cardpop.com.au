import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardPen, Plus, Pencil, ExternalLink, CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import HalfStars from '@/components/reviews/HalfStars.jsx';
import { GO_AGAIN_MAP, isValidScore } from '@/utils/eventReview.js';
import { toCdnUrl } from '@/utils/imageUrl.js';

// Admin → Event Reviews. Every review (draft or published) with the event it
// covers; "Write a review" opens the full-page editor. See docs/event-reviews.md.

const EventReviewsAdminPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_reviews')
        .select('id, overall_rating, go_again, attended_on, updated_at, article:blog_articles(id, slug, title, is_published, published_at, featured_image_url, author), event:events(id, slug, title, start_date, suburb, state)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      toast.error(err.message || 'Could not load event reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <Helmet><title>Event Reviews — Admin | CardPop</title></Helmet>
      <AdminPageHeader
        icon={ClipboardPen}
        title="Event Reviews"
        subtitle="First-hand write-ups of the card shows and events CardPop attends. Each review is a Parallel Report article plus a scorecard, quick facts, photos and pickups, and is linked from the event's own page."
      >
        <div className="flex items-center gap-2">
          <Button onClick={load} variant="outline" className="rounded-xl h-10 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => navigate('/admin/event-reviews/new')} className="rounded-xl h-10 px-4 font-bold">
            <Plus className="w-4 h-4 mr-1.5" /> Write a review
          </Button>
        </div>
      </AdminPageHeader>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <ClipboardPen className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <h2 className="font-heading text-xl font-bold mb-1">No event reviews yet</h2>
          <p className="text-sm text-muted-foreground mb-5">Been to a show? Rate the day, add your photos and pickups, and publish it to The Parallel Report.</p>
          <Button onClick={() => navigate('/admin/event-reviews/new')} className="rounded-xl font-bold"><Plus className="w-4 h-4 mr-1.5" /> Write your first review</Button>
        </div>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {rows.map((r) => {
            const a = r.article || {};
            const ev = r.event;
            const cover = toCdnUrl(a.featured_image_url);
            return (
              <li key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="h-20 w-full sm:w-32 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {cover && <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={a.is_published ? 'default' : 'outline'} className="text-[10px] font-bold uppercase tracking-wider">
                      {a.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    {isValidScore(r.overall_rating) && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <HalfStars value={r.overall_rating} size="w-3.5 h-3.5" /> {Number(r.overall_rating).toFixed(1).replace(/\.0$/, '')}
                      </span>
                    )}
                    {GO_AGAIN_MAP[r.go_again] && <span className="text-xs text-muted-foreground">Go again: {GO_AGAIN_MAP[r.go_again].label}</span>}
                  </div>
                  <h3 className="font-semibold text-foreground leading-snug truncate">{a.title || 'Untitled review'}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                    <CalendarDays className="w-3.5 h-3.5 inline" aria-hidden="true" />
                    {ev ? (
                      <Link to={`/events/${ev.slug || ev.id}`} className="hover:underline">
                        {ev.title}{ev.start_date ? ` · ${format(new Date(`${ev.start_date}T00:00:00`), 'd MMM yyyy')}` : ''}{[ev.suburb, ev.state].filter(Boolean).length ? ` · ${[ev.suburb, ev.state].filter(Boolean).join(', ')}` : ''}
                      </Link>
                    ) : <span className="italic">No event linked</span>}
                    <span>· Updated {format(new Date(r.updated_at), 'd MMM yyyy, h:mm a')}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.is_published && a.slug && (
                    <Button asChild variant="outline" size="sm" className="rounded-lg">
                      <Link to={`/blog/${a.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-1" /> View</Link>
                    </Button>
                  )}
                  <Button size="sm" className="rounded-lg" onClick={() => navigate(`/admin/event-reviews/${r.id}`)}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default EventReviewsAdminPage;
