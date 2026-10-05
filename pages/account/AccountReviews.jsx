import React, { useState, useEffect, useRef } from 'react';
import { Star, ShieldCheck, RefreshCw } from 'lucide-react';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import { isVerified } from '@/utils/verification.js';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const StarRating = ({ rating, size = 'sm' }) => {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= rating ? 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
};

const ReviewCard = ({ review }) => {
  const author = review.reviewer;
  const timeAgo = review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true }) : '';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProfileAvatar profile={author} size="sm" name={author?.display_name || author?.username || '?'} />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-sm">{author?.display_name || author?.username || 'Anonymous'}</p>
              {isVerified(author?.is_verified) && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} />
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* Every rating is written through the order-verified endpoint, so an
              attached order is proof of a real transaction. */}
          {review.order_id && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3 h-3" /> Verified Transaction
            </div>
          )}
        </div>
      </div>
      {review.comment && (
        <p className="text-sm text-foreground/80 leading-relaxed">"{review.comment}"</p>
      )}
    </div>
  );
};

const AccountReviews = () => {
  const { currentUser } = useAuth();
  const [received, setReceived] = useState([]);
  const [given, setGiven] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    const uid = currentUser.id;

    const run = async () => {
      setLoading(true);
      try {
        // Both read the canonical seller_ratings pipeline through the API —
        // the same source the marketplace rating widgets display.
        const [receivedRes, givenRes] = await Promise.all([
          apiServerClient.fetch(`/seller-ratings/${uid}`).catch(() => null),
          apiServerClient.fetch('/seller-ratings/mine/given').catch(() => null),
        ]);
        const receivedBody = receivedRes?.ok ? await receivedRes.json() : null;
        const givenBody = givenRes?.ok ? await givenRes.json() : null;
        if (!cancelled) {
          if (!receivedBody || !givenBody) {
            console.error('Failed to load reviews:', receivedRes?.status, givenRes?.status);
            toast.error('Some review data failed to load — the totals below may be incomplete.');
          }
          setReceived(receivedBody?.ratings ?? []);
          setGiven(givenBody?.ratings ?? []);
          setStats(receivedBody?.stats ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const count = stats?.total || 0;
  const avg = count > 0 ? parseFloat(stats.average).toFixed(1) : null;

  return (
    <AccountPageShell
      documentTitle="Reviews | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Reviews' }]}
      title="Reviews"
      description="Your buyer and seller feedback."
      actions={
        <Button variant="outline" size="sm" onClick={() => fetchRef.current?.()} disabled={loading} className="rounded-xl shadow-sm h-10 px-4 font-bold">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      }
    >
      {/* Rating summary */}
      {(avg || count > 0) && (
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-extrabold tabular-nums">{avg ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">{count} review{count !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-col gap-1">
            <StarRating rating={Math.round(parseFloat(avg || 0))} size="lg" />
            <p className="text-sm text-muted-foreground">Average seller rating</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="received">
        <TabsList className="mb-6">
          <TabsTrigger value="received">
            Received {received.length > 0 && <span className="ml-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5">{received.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="given">
            Given {given.length > 0 && <span className="ml-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-full px-1.5 py-0.5">{given.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : received.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-bold mb-2">No reviews yet</h3>
              <p className="text-muted-foreground">Reviews from completed transactions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">{received.map(r => <ReviewCard key={r.id} review={r} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="given">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : given.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-bold mb-2">No reviews given</h3>
              <p className="text-muted-foreground">After completing a transaction, you can leave a review for the other party.</p>
            </div>
          ) : (
            <div className="space-y-3">{given.map(r => <ReviewCard key={r.id} review={{ ...r, reviewer: r.seller }} />)}</div>
          )}
        </TabsContent>
      </Tabs>
    </AccountPageShell>
  );
};

export default AccountReviews;
