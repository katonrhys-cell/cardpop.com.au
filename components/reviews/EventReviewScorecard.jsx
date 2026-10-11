import React from 'react';
import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import HalfStars from '@/components/reviews/HalfStars.jsx';
import {
  SCORE_CATEGORIES,
  GO_AGAIN_MAP,
  isValidScore,
  cleanScores,
  formatScore,
} from '@/utils/eventReview.js';

const GO_AGAIN_STYLE = {
  yes:   { icon: ThumbsUp,   className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  maybe: { icon: Minus,      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  no:    { icon: ThumbsDown, className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

// The star scorecard: one big overall, five sub-scores as stars + bar, and the
// "would we go again?" verdict. Renders nothing when there is no rating at all.
const EventReviewScorecard = ({ review, compact = false }) => {
  if (!review) return null;
  const scores = cleanScores(review.scores);
  const hasOverall = isValidScore(review.overall_rating);
  if (!hasOverall && Object.keys(scores).length === 0) return null;

  const goAgain = GO_AGAIN_MAP[review.go_again];
  const goStyle = GO_AGAIN_STYLE[review.go_again];

  return (
    <section
      aria-labelledby="event-review-scorecard"
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="bg-brand-charcoal text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">CardPop Scorecard</p>
          <h2 id="event-review-scorecard" className="font-heading text-lg font-bold leading-tight">How the day rated</h2>
        </div>
        {hasOverall && (
          <div className="flex items-center gap-3">
            <span className="font-heading text-4xl font-bold tabular-nums leading-none">
              {Number(review.overall_rating).toFixed(1).replace(/\.0$/, '')}
              <span className="text-base font-semibold text-white/50"> / 5</span>
            </span>
            <HalfStars value={review.overall_rating} size="w-5 h-5" />
          </div>
        )}
      </div>

      <div className={`px-5 py-4 grid gap-x-8 gap-y-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {SCORE_CATEGORIES.map((cat) => {
          const v = scores[cat.id];
          if (!isValidScore(v)) return null;
          return (
            <div key={cat.id} className="flex items-center justify-between gap-4 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{cat.label}</p>
                <div className="mt-1 h-1.5 w-full max-w-[12rem] rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${(v / 5) * 100}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <HalfStars value={v} size="w-3.5 h-3.5" label={`${cat.label}: ${formatScore(v)}`} />
                <span className="text-sm font-bold tabular-nums w-8 text-right">{Number(v).toFixed(1).replace(/\.0$/, '')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {(goAgain || review.verdict) && (
        <div className="px-5 pb-5 pt-1 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-border/60 mt-1">
          {goAgain && goStyle && (
            <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-bold ${goStyle.className}`}>
              <goStyle.icon className="w-3.5 h-3.5" aria-hidden="true" />
              Would we go again? {goAgain.label}
            </span>
          )}
          {review.verdict && (
            <p className="text-sm text-foreground/90 italic leading-snug">“{review.verdict}”</p>
          )}
        </div>
      )}
    </section>
  );
};

export default EventReviewScorecard;
