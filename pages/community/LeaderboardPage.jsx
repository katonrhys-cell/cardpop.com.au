import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, Dice5, Sparkles, Star, ShoppingBag, ArrowRightLeft, CalendarCheck, Gift } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { toast } from 'sonner';

const REASON_META = {
  daily_claim:        { label: 'Daily claim',      Icon: CalendarCheck },
  sale_completed:     { label: 'Sale completed',   Icon: ShoppingBag },
  purchase_completed: { label: 'Purchase',         Icon: ShoppingBag },
  review_written:     { label: 'Review written',   Icon: Star },
  trade_completed:    { label: 'Trade completed',  Icon: ArrowRightLeft },
  listing_created:    { label: 'Listing created',  Icon: Sparkles },
  admin_grant:        { label: 'Bonus',            Icon: Gift },
};

const RANK_STYLES = [
  'bg-amber-400/15 text-amber-600 border-amber-400/30',   // 1st
  'bg-slate-400/15 text-slate-500 border-slate-400/30',   // 2nd
  'bg-orange-400/15 text-orange-600 border-orange-400/30' // 3rd
];

const monthName = () => new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

const LeaderboardPage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [leaders, setLeaders] = useState(null); // null = loading
  const [me, setMe] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const fetchAll = useCallback(async () => {
    const [boardRes, meRes] = await Promise.all([
      fetch('/api/points/leaderboard').then(r => (r.ok ? r.json() : null)).catch(() => null),
      isAuthenticated
        ? apiServerClient.fetch('/points/me').then(r => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null),
    ]);
    setLeaders(boardRes?.leaders ?? []);
    setMe(meRes);
  }, [isAuthenticated]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await apiServerClient.fetch('/points/claim', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.info(body.error || 'Already claimed today');
        setMe(prev => (prev ? { ...prev, claimedToday: true } : prev));
        return;
      }
      if (!res.ok) throw new Error(body.error || 'Claim failed');
      toast.success(`+${body.points} points! Come back tomorrow for more.`);
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Could not claim points');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Collector Leaderboard | CardPop Australia™"
        description="CardPop's monthly collector leaderboard — earn points for selling, buying, trading, reviews and daily check-ins."
        canonicalUrl="https://cardpop.com.au/community/leaderboard"
      />

      <section className="bg-card border-b border-border py-14 md:py-20 text-center">
        <div className="container-default">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-6" />
          <Badge variant="outline" className="mb-4 text-xs font-semibold tracking-widest uppercase border-primary/40 text-primary px-3 py-1">
            {monthName()}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Collector Leaderboard</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Points for the things that make the hobby go — sales, purchases, trades, reviews
            and showing up. The board resets every month.
          </p>
        </div>
      </section>

      <div className="w-full max-w-3xl mx-auto px-5 py-10 md:py-14 flex-1 space-y-8">
        {/* Own points + daily claim */}
        {isAuthenticated && me && (
          <div className="bg-card border border-border rounded-3xl p-6 flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">This month</p>
                <p className="text-3xl font-extrabold tabular-nums">{me.monthTotal}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">All time</p>
                <p className="text-3xl font-extrabold tabular-nums">{me.total}</p>
              </div>
            </div>
            <Button onClick={claim} disabled={claiming || me.claimedToday} className="rounded-xl font-bold gap-2 h-11 px-6">
              <Dice5 className="w-4 h-4" />
              {me.claimedToday ? 'Claimed — back tomorrow' : (claiming ? 'Rolling…' : "Claim today's points")}
            </Button>
          </div>
        )}

        {/* Board */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Top collectors — {monthName()}</h2>
          </div>
          {leaders === null ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : leaders.length === 0 ? (
            <div className="p-14 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
              <p className="font-bold text-foreground mb-1">The board is wide open</p>
              <p className="text-sm text-muted-foreground">Nobody has scored yet this month — a single daily claim would put you on top.</p>
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {leaders.map((row, i) => {
                const isMe = row.user_id === currentUser?.id;
                return (
                  <li key={row.user_id} className={`flex items-center gap-4 px-6 py-3.5 ${isMe ? 'bg-primary/5' : ''}`}>
                    <span className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-extrabold tabular-nums shrink-0 ${RANK_STYLES[i] || 'bg-muted/40 text-muted-foreground border-border'}`}>
                      {i + 1}
                    </span>
                    <ProfileAvatar profile={row} size="sm" />
                    <p className="font-bold text-sm truncate flex-1">
                      {row.display_name || row.username || 'Collector'}
                      {isMe && <span className="ml-2 text-xs font-semibold text-primary">You</span>}
                    </p>
                    <p className="font-extrabold tabular-nums">{row.total_points}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Recent activity */}
        {isAuthenticated && me?.recent?.length > 0 && (
          <div className="bg-card border border-border rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Your recent points</h2>
            </div>
            <ul className="divide-y divide-border">
              {me.recent.map((r, i) => {
                const meta = REASON_META[r.reason] || { label: r.reason, Icon: Sparkles };
                return (
                  <li key={i} className="flex items-center gap-3 px-6 py-3 text-sm">
                    <meta.Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1">{meta.label}</span>
                    <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString('en-AU')}</span>
                    <span className="font-bold tabular-nums text-emerald-600">+{r.points}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* How points work */}
        <div className="bg-muted/30 border border-border rounded-3xl p-6">
          <h3 className="font-bold text-sm mb-3">How points work</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Completed sale: <strong className="text-foreground">25</strong> · completed purchase: <strong className="text-foreground">15</strong></li>
            <li>• Accepted trade: <strong className="text-foreground">15</strong> each · review written: <strong className="text-foreground">10</strong></li>
            <li>• Daily claim: <strong className="text-foreground">5–25</strong>, once a day</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            Points track your activity and monthly standing. They have no cash value.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
