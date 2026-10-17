import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Star, MessageSquareQuote, Loader2, Pencil, Trash2, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import HalfStars from '@/components/reviews/HalfStars.jsx';
import { toLocalDateStr } from '@/lib/eventSeo.js';
import {
  fetchEventReviews,
  fetchReviewStatsMap,
  submitEventReview,
  updateEventReview,
  deleteEventReview,
  hideEventReview,
} from '@/lib/eventAttendeeReviews.js';
import { canReviewEvent, validateAttendeeReview, REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from '@/utils/eventPast.js';

const FILL = 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]';
const EMPTY = 'text-muted-foreground/30';
const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

// Whole-star picker (the table stores 1–5). Each star is a real radio button
// so Tab + arrow keys work and screen readers get a radiogroup.
const StarPicker = ({ value, onChange, disabled }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || Number(value) || 0;
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center gap-0.5" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={Number(value) === i}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            disabled={disabled}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(i)}
            className="rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Star className={`w-8 h-8 transition-colors ${shown >= i ? FILL : EMPTY}`} />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-muted-foreground min-w-[5rem]" aria-live="polite">
        {shown ? STAR_WORDS[shown] : 'Tap a star'}
      </span>
    </div>
  );
};

const formatDay = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const ReviewForm = ({ initial, onSubmit, onCancel, busy }) => {
  const [rating, setRating] = useState(initial?.rating || 0);
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [problem, setProblem] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validateAttendeeReview({ rating, title, body });
    setProblem(err);
    if (err) return;
    onSubmit({ rating, title: title.trim(), body: body.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4" aria-label={initial ? 'Edit your review' : 'Write a review'}>
      <div>
        <p className="font-bold mb-2">{initial ? 'Edit your review' : 'How was it?'}</p>
        <StarPicker value={rating} onChange={setRating} disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-review-title" className="text-xs font-semibold text-muted-foreground">Headline (optional)</label>
        <Input
          id="event-review-title"
          value={title}
          maxLength={REVIEW_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Worth the drive for the vintage tables"
          disabled={busy}
          className="h-11 rounded-xl bg-background"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="event-review-body" className="text-xs font-semibold text-muted-foreground">Your review</label>
        <Textarea
          id="event-review-body"
          value={body}
          maxLength={REVIEW_BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Vendors, prices, the venue, parking, what you picked up — whatever another collector would want to know before going next time."
          rows={5}
          disabled={busy}
          className="rounded-xl bg-background"
        />
        <p className="text-xs text-muted-foreground text-right">{body.length}/{REVIEW_BODY_MAX}</p>
      </div>
      {problem && <p className="text-sm text-destructive font-medium" role="alert">{problem}</p>}
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} className="rounded-xl">Cancel</Button>
        )}
        <Button type="submit" disabled={busy} className="rounded-xl font-bold gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {initial ? 'Save changes' : 'Post review'}
        </Button>
      </div>
    </form>
  );
};

// Collector reviews of a finished event: the star summary, the list, and —
// for a signed-in viewer — the form (one review each; edit or remove your own).
// Renders nothing for an event that hasn't finished: utils/eventPast.js and
// the DB's event_has_ended() agree on what "finished" means.
const EventAttendeeReviews = ({ event }) => {
  const eventId = event?.id;
  const { currentUser, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const today = useMemo(() => toLocalDateStr(new Date()), []);
  const open = canReviewEvent(event, today);

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, statsMap] = await Promise.all([
        fetchEventReviews(eventId),
        fetchReviewStatsMap([eventId]).catch(() => ({})),
      ]);
      setReviews(list);
      setStats(statsMap[eventId] || null);
    } catch (err) {
      console.error('Failed to load event reviews:', err);
      setError('Unable to load reviews right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  if (!open) return null;

  const myId = currentUser?.id || null;
  const mine = myId ? reviews.find((r) => r.reviewer_id === myId) : null;
  const others = mine ? reviews.filter((r) => r.id !== mine.id) : reviews;
  const count = stats?.review_count ?? reviews.length;
  const average = stats?.average_rating
    ?? (reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0);

  const refreshStats = async () => {
    try {
      const map = await fetchReviewStatsMap([eventId]);
      setStats(map[eventId] || null);
    } catch {
      /* decoration only */
    }
  };

  const handleCreate = async (values) => {
    setBusy(true);
    try {
      const row = await submitEventReview({ eventId, userId: myId, ...values });
      setReviews((prev) => [row, ...prev]);
      await refreshStats();
      toast.success('Thanks — your review is live.');
    } catch (err) {
      const code = err?.code || '';
      toast.error(
        code === '23505' ? "You've already reviewed this event."
          : code === '22023' ? 'Reviews open once the event has finished.'
            : 'Could not post your review. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (values) => {
    if (!mine) return;
    setBusy(true);
    try {
      const row = await updateEventReview(mine.id, values);
      setReviews((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      setEditing(false);
      await refreshStats();
      toast.success('Review updated.');
    } catch {
      toast.error('Could not save your changes. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (review) => {
    if (!window.confirm('Remove this review?')) return;
    setBusy(true);
    try {
      await deleteEventReview(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      await refreshStats();
      toast.success('Review removed.');
    } catch {
      toast.error('Could not remove the review.');
    } finally {
      setBusy(false);
    }
  };

  const handleHide = async (review) => {
    if (!window.confirm('Hide this review from the site? The author will still see it.')) return;
    setBusy(true);
    try {
      await hideEventReview(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      await refreshStats();
      toast.success('Review hidden.');
    } catch {
      toast.error('Could not hide the review.');
    } finally {
      setBusy(false);
    }
  };

  const renderReview = (review, { own = false } = {}) => {
    const profile = review.profiles;
    const name = profile?.display_name || profile?.username || review.reviewer_name || 'Collector';
    return (
      <article key={review.id} className={`bg-card border rounded-2xl p-5 ${own ? 'border-primary/30' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <ProfileAvatar profile={profile || { id: review.reviewer_id }} size="sm" name={name} />
            <div>
              <p className="font-semibold leading-tight">
                {name}
                {own && <span className="ml-2 text-xs font-bold uppercase tracking-wide text-primary">Your review</span>}
              </p>
              <p className="text-xs text-muted-foreground">{formatDay(review.created_at)}</p>
            </div>
          </div>
          <HalfStars value={review.rating} label={`${review.rating} out of 5 stars`} />
        </div>
        {review.title && <h3 className="font-bold mt-3">{review.title}</h3>}
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap mt-2">{review.body}</p>
        {(own || isAdmin) && (
          <div className="flex items-center gap-2 mt-4">
            {own && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
            {own && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-destructive hover:text-destructive border-destructive/20" disabled={busy} onClick={() => handleDelete(review)}>
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
            {!own && isAdmin && (
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" disabled={busy} onClick={() => handleHide(review)} title="Admin: hide this review">
                <EyeOff className="w-3.5 h-3.5" /> Hide
              </Button>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <section id="reviews" className="mt-10 scroll-mt-24" aria-labelledby="event-reviews-heading">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <h2 id="event-reviews-heading" className="text-2xl font-bold font-serif flex items-center gap-2.5">
          <MessageSquareQuote className="w-6 h-6 text-primary" /> Collector Reviews
        </h2>
        {count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <HalfStars value={average} size="w-5 h-5" />
            <span className="font-bold text-lg">{Number(average).toFixed(1)}</span>
            <span className="text-muted-foreground">from {count} review{count !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center mb-5">
          <p className="text-muted-foreground mb-4">Were you at this event? Sign in to rate it and tell other collectors how it went.</p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild className="rounded-xl font-bold">
              <Link to="/signup" state={{ from: { pathname: `${location.pathname}#reviews` } }}>Join to Review</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-bold">
              <Link to="/login" state={{ from: { pathname: `${location.pathname}#reviews` } }}>Sign In</Link>
            </Button>
          </div>
        </div>
      ) : loading ? null : mine ? (
        editing ? (
          <div className="mb-5">
            <ReviewForm initial={mine} onSubmit={handleUpdate} onCancel={() => setEditing(false)} busy={busy} />
          </div>
        ) : (
          <div className="mb-5">{renderReview(mine, { own: true })}</div>
        )
      ) : (
        <div className="mb-5">
          <ReviewForm onSubmit={handleCreate} busy={busy} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="bg-card border border-destructive/20 border-dashed rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={load} variant="outline" className="rounded-xl font-bold">Try again</Button>
        </div>
      ) : others.length === 0 ? (
        !mine && (
          <div className="bg-card border border-border border-dashed rounded-2xl p-8 text-center">
            <Star className="w-10 h-10 text-muted-foreground opacity-40 mx-auto mb-3" />
            <p className="font-bold mb-1">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Be the first to tell collectors how {event.title || 'this event'} went.</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {others.map((r) => renderReview(r))}
        </div>
      )}
      {busy && <span className="sr-only" aria-live="polite">Saving…</span>}
    </section>
  );
};

export default EventAttendeeReviews;
