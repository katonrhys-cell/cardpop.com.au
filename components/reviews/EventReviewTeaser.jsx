import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { toCdnUrl } from '@/utils/imageUrl.js';
import HalfStars from '@/components/reviews/HalfStars.jsx';
import { GO_AGAIN_MAP, isValidScore } from '@/utils/eventReview.js';

// Fetch the published review for an event: the structured row joined to the
// article it lives in. RLS only returns rows whose article is published, so
// a draft never leaks here. Null when the event has no review yet.
export const fetchPublishedEventReview = async (eventId) => {
  if (!eventId) return null;
  const { data, error } = await supabase
    .from('event_reviews')
    .select('id, overall_rating, go_again, verdict, attended_on, article:blog_articles!inner(id, slug, title, excerpt, featured_image_url, author, published_at, is_published)')
    .eq('event_id', eventId)
    .eq('article.is_published', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

// "CardPop was there" card for the event page — stars, verdict, one-line
// summary, cover photo and a link to the full review in The Parallel Report.
const EventReviewTeaser = ({ eventId }) => {
  const [review, setReview] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchPublishedEventReview(eventId)
      .then((r) => { if (alive) setReview(r); })
      .catch(() => { if (alive) setReview(null); });
    return () => { alive = false; };
  }, [eventId]);

  const article = review?.article;
  if (!review || !article) return null;

  const goAgain = GO_AGAIN_MAP[review.go_again];
  const cover = toCdnUrl(article.featured_image_url);
  const href = `/blog/${article.slug || article.id}`;

  return (
    <section aria-labelledby="event-review-teaser" className="mt-10">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-brand-charcoal text-white shadow-sm">
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="p-6 sm:p-8 flex flex-col justify-center">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase text-white/60 mb-3">
              <BadgeCheck className="w-3.5 h-3.5 text-brand-red" aria-hidden="true" /> CardPop was there
            </p>
            <h2 id="event-review-teaser" className="font-heading text-2xl sm:text-3xl font-bold leading-tight text-balance mb-3">
              {article.title}
            </h2>
            {isValidScore(review.overall_rating) && (
              <div className="flex items-center gap-3 mb-3">
                <HalfStars value={review.overall_rating} size="w-5 h-5" />
                <span className="text-sm font-bold tabular-nums">
                  {Number(review.overall_rating).toFixed(1).replace(/\.0$/, '')} / 5
                </span>
                {goAgain && (
                  <span className="text-xs font-semibold text-white/70">· Would we go again? <span className="text-white">{goAgain.label}</span></span>
                )}
              </div>
            )}
            {(review.verdict || article.excerpt) && (
              <p className="text-sm text-white/70 leading-relaxed mb-5 max-w-prose">
                {review.verdict ? `“${review.verdict}”` : article.excerpt}
              </p>
            )}
            <Link
              to={href}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red/90 transition-colors"
            >
              Read the full review <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          {cover && (
            <Link to={href} className="relative block min-h-[14rem] md:min-h-full" aria-hidden="true" tabIndex={-1}>
              <img src={cover} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-r from-brand-charcoal via-brand-charcoal/20 to-transparent md:block hidden" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default EventReviewTeaser;
