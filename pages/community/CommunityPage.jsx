// Community Hub — the front door to every area of the Community section. It
// mirrors the header's Community menu (same lists, from lib/communityNav.js)
// so a collector can see the whole section in one place: a directory of every
// area, then a live taste of each — latest discussions, this month's leaders,
// upcoming events, new collectors, the latest Parallel Report articles and the
// retailers & suppliers — rather than the three-tab page it replaced.
import React, { useEffect, useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { PROFILE_CARD_COLUMNS } from '@/lib/profileColumns.js';
import { COMMUNITY_ITEMS, EVENT_ITEMS, READS_ITEM, badgeStyle } from '@/lib/communityNav.js';
import { EVENT_CARD_COLUMNS } from '@/pages/community/CommunityEventsPage.jsx';
import { BLOG_CARD_COLUMNS } from '@/pages/blog/BlogPage.jsx';
import { eventPath, formatEventDate, formatEventLocation, eventTypeLabel, eventTypeStyle, toLocalDateStr } from '@/lib/eventSeo.js';
import { publicImageUrl, cardThumbUrl } from '@/utils/imageUrl.js';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { isVerified } from '@/utils/verification.js';
import {
  MessageSquare, Users, Store, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight,
  Rocket, ArrowRight, Award, Calendar, MapPin, Trophy,
} from 'lucide-react';

import WhatnotIcon from '@/components/WhatnotIcon.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';

const TOTAL_SLIDES = 3;

// The little picture on an upcoming-event tile: the event's own poster/logo
// (`events.image_url`, routed through the image CDN like every stored image).
// Loads the 480 px `.thumb.webp` companion when the upload has one
// (utils/uploadEventImage.js), falls back to the full poster if the thumb
// fails, and to the event-type icon only when there is no picture at all or
// it fails to load.
function EventThumb({ event, style }) {
  const full = publicImageUrl(event?.image_url || null);
  const [src, setSrc] = useState(() => cardThumbUrl(event?.image_url || null));
  if (src && full) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setSrc(src !== full ? full : null)}
        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border bg-muted shadow-sm"
        data-testid="event-thumb"
      />
    );
  }
  if (!style) return null;
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${style.gradient} shrink-0 shadow-sm`}>
      <style.Icon className="w-5 h-5 text-white" />
    </span>
  );
}

// Explicit projections — the hub shows a handful of rows from each area, so
// it reads only what the preview renders (never `*`).
const DISCUSSION_PREVIEW_COLUMNS = 'id, title, category, comment_count, created_at';
const RETAILER_PREVIEW_COLUMNS = 'id, business_name, business_type, logo_url, tagline, about, website_url';

const DISCUSSIONS_LIMIT = 5;
const LEADERS_LIMIT = 5;
const EVENTS_LIMIT = 4;
const ARTICLES_LIMIT = 3;
const PROFILES_LIMIT = 6;
const RETAILERS_LIMIT = 6;

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const RANK_STYLES = [
  'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300',
];

const monthName = () => new Date().toLocaleDateString('en-AU', { month: 'long' });

// One query per preview; each settles on its own so a slow or failing area
// never blanks the rest of the hub.
const usePreview = (run, deps = []) => {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null });
    Promise.resolve()
      .then(run)
      .then((data) => { if (!cancelled) setState({ data: data || [], error: null }); })
      .catch(() => { if (!cancelled) setState({ data: [], error: true }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
};

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

// ─── Directory tile: one per area of the menu ────────────────────────────────
const AreaTile = ({ item, compact = false }) => {
  const badge = badgeStyle(item);
  return (
    <Link
      to={item.href}
      className={`group flex items-center gap-3 rounded-2xl border border-border bg-card ${compact ? 'p-3.5' : 'p-4'} hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all`}
    >
      <span
        className={`inline-flex items-center justify-center ${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl shrink-0 shadow-sm overflow-hidden ${badge.className}`}
        style={badge.style}
      >
        <item.Icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" aria-hidden="true" />
    </Link>
  );
};

// ─── Section chrome shared by every preview ──────────────────────────────────
const SectionHeading = ({ Icon, title, blurb, to, cta = 'See all', action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-5">
    <div className="min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />}
        {title}
      </h2>
      {blurb && <p className="text-sm text-muted-foreground mt-1">{blurb}</p>}
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {action}
      {to && (
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline whitespace-nowrap">
          {cta} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  </div>
);

const EmptyState = ({ Icon, title, children, error = false }) => (
  <div className={`flex flex-col items-center justify-center py-12 px-4 text-center bg-muted/30 rounded-3xl border border-dashed ${error ? 'border-destructive/20' : 'border-border'}`}>
    <Icon className={`w-10 h-10 mb-3 ${error ? 'text-destructive opacity-40' : 'text-muted-foreground opacity-50'}`} />
    <p className="text-foreground font-bold mb-1">{title}</p>
    {children && <p className="text-sm text-muted-foreground">{children}</p>}
  </div>
);

const CommunityPage = () => {
  const { settings } = usePlatformSettings();
  const blogEnabled = settings.enable_blog !== false;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [slideKey, setSlideKey] = useState(0);

  const goToSlide = (i) => {
    setCurrentSlide(i);
    setSlideKey(prev => prev + 1);
  };
  const prevSlide = () => goToSlide((currentSlide - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  const nextSlide = () => goToSlide((currentSlide + 1) % TOTAL_SLIDES);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % TOTAL_SLIDES);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, slideKey]);

  const discussions = usePreview(() => supabase
    .from('posts')
    .select(DISCUSSION_PREVIEW_COLUMNS)
    .eq('post_type', 'text')
    .order('created_at', { ascending: false })
    .limit(DISCUSSIONS_LIMIT)
    .then(unwrap));

  // Public endpoint — the leaderboard page reads it the same way.
  const leaders = usePreview(() => fetch('/api/points/leaderboard')
    .then(r => (r.ok ? r.json() : null))
    .then(body => (body?.leaders || []).slice(0, LEADERS_LIMIT)));

  const events = usePreview(() => supabase
    .from('events_public')
    .select(EVENT_CARD_COLUMNS)
    .eq('status', 'approved')
    .gte('start_date', toLocalDateStr(new Date()))
    .order('start_date', { ascending: true })
    .limit(EVENTS_LIMIT)
    .then(unwrap));

  const articles = usePreview(() => (blogEnabled
    ? supabase
      .from('blog_articles')
      .select(BLOG_CARD_COLUMNS)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(ARTICLES_LIMIT)
      .then(unwrap)
    : []), [blogEnabled]);

  const profiles = usePreview(() => supabase
    .from('profiles')
    .select(PROFILE_CARD_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(PROFILES_LIMIT * 2)
    .then(unwrap)
    .then((rows) => {
      // Deduplicate by user id to prevent duplicates
      const seen = new Set();
      return (rows || []).filter(p => (seen.has(p.id) ? false : seen.add(p.id))).slice(0, PROFILES_LIMIT);
    }));

  const retailers = usePreview(() => supabase
    .from('business_profiles')
    .select(RETAILER_PREVIEW_COLUMNS)
    .eq('storefront_status', 'approved')
    .order('business_name', { ascending: true })
    .limit(RETAILERS_LIMIT)
    .then(unwrap));

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Community Hub | CardPop"
        description="The home for Australian trading card collectors: forum, leaderboard, collector profiles, local traders, the community map, card shows and events, Whatnot shows and The Parallel Report."
      />

      {/* ── Hero ── */}
      <section className="bg-card border-b border-border py-14 sm:py-20 text-center">
        <div className="container-default">
          <Users className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Community Hub</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A home for collectors. Talk cards on the forum, climb the monthly leaderboard, find traders and shows near you, and keep up with The Parallel Report — all in one place.
          </p>
        </div>
      </section>

      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 space-y-14">
        {/* ── Directory: every area of the Community menu ── */}
        <section aria-labelledby="community-areas">
          <h2 id="community-areas" className="sr-only">Explore the community</h2>
          <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
            <div>
              <Link to="/community/forum" className="group/heading flex items-center gap-1 mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
                Community <ArrowRight className="w-3 h-3 opacity-0 -translate-x-0.5 group-hover/heading:opacity-100 group-hover/heading:translate-x-0 transition-all" aria-hidden="true" />
              </Link>
              <div className="grid gap-3 sm:grid-cols-2">
                {COMMUNITY_ITEMS.map(item => <AreaTile key={item.href} item={item} />)}
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <Link to="/events" className="group/heading flex items-center gap-1 mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
                  Events <ArrowRight className="w-3 h-3 opacity-0 -translate-x-0.5 group-hover/heading:opacity-100 group-hover/heading:translate-x-0 transition-all" aria-hidden="true" />
                </Link>
                <div className="grid gap-3">
                  {EVENT_ITEMS.map(item => <AreaTile key={item.href} item={item} compact />)}
                </div>
              </div>
              {blogEnabled && (
                <div>
                  <Link to="/blog" className="group/heading flex items-center gap-1 mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
                    Reads <ArrowRight className="w-3 h-3 opacity-0 -translate-x-0.5 group-hover/heading:opacity-100 group-hover/heading:translate-x-0 transition-all" aria-hidden="true" />
                  </Link>
                  <AreaTile item={READS_ITEM} compact />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Forum + Leaderboard ── */}
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <section aria-labelledby="hub-forum">
            <SectionHeading
              Icon={MessageSquare}
              title={<span id="hub-forum">Latest discussions</span>}
              blurb="What collectors are talking about right now."
              to="/community/forum"
              cta="Go to the forum"
              action={<Button asChild size="sm"><Link to="/community/discussion/new">Start a discussion</Link></Button>}
            />
            {discussions.data === null ? (
              <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
            ) : discussions.error ? (
              <EmptyState Icon={MessageSquare} title="Couldn't load discussions" error>Unable to load discussions right now.</EmptyState>
            ) : discussions.data.length > 0 ? (
              <div className="space-y-3">
                {discussions.data.map(post => (
                  <Link
                    key={post.id}
                    to={`/community/discussion/${post.id}`}
                    className="block bg-card border border-border p-5 rounded-2xl hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <h3 className="font-bold mb-1.5 line-clamp-1">{post.title || 'Untitled Discussion'}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="secondary">{post.category || 'General'}</Badge>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{post.comment_count || 0} replies</span>
                      {post.created_at && <span>{timeAgo(post.created_at)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState Icon={MessageSquare} title="No discussions yet">Be the first to start a conversation!</EmptyState>
            )}
          </section>

          <section aria-labelledby="hub-leaderboard">
            <SectionHeading
              Icon={Trophy}
              title={<span id="hub-leaderboard">{monthName()} leaderboard</span>}
              blurb="Points for showing up, listing, trading and attending."
              to="/community/leaderboard"
              cta="Full leaderboard"
            />
            {leaders.data === null ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : leaders.error ? (
              <EmptyState Icon={Award} title="Couldn't load the leaderboard" error>Unable to load the leaderboard right now.</EmptyState>
            ) : leaders.data.length > 0 ? (
              <ol className="bg-card border border-border rounded-2xl divide-y divide-border">
                {leaders.data.map((row, i) => (
                  <li key={row.user_id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-extrabold tabular-nums shrink-0 ${RANK_STYLES[i] || 'bg-muted/40 text-muted-foreground border-border'}`}>
                      {i + 1}
                    </span>
                    <ProfileAvatar profile={row} size="sm" />
                    <p className="font-semibold text-sm truncate flex-1">{row.display_name || row.username || 'Collector'}</p>
                    <p className="font-extrabold tabular-nums text-sm">{row.total_points}<span className="ml-1 text-xs font-medium text-muted-foreground">pts</span></p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState Icon={Award} title="No points on the board yet">Claim your daily points to be the first on this month's leaderboard.</EmptyState>
            )}
          </section>
        </div>

        {/* ── Upcoming events ── */}
        <section aria-labelledby="hub-events">
          <SectionHeading
            Icon={Calendar}
            title={<span id="hub-events">Upcoming events</span>}
            blurb="Card shows, trade nights, meetups and store tournaments across Australia."
            to="/events"
            cta="Full calendar"
          />
          {events.data === null ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array(EVENTS_LIMIT).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
          ) : events.error ? (
            <EmptyState Icon={Calendar} title="Couldn't load events" error>Unable to load events right now.</EmptyState>
          ) : events.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {events.data.map(event => {
                const style = eventTypeStyle(event);
                return (
                  <Link
                    key={event.id}
                    to={eventPath(event)}
                    className="group flex flex-col gap-2 bg-card border border-border p-5 rounded-2xl hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <EventThumb event={event} style={style} />
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">{eventTypeLabel(event)}</Badge>
                    </div>
                    <h3 className="font-bold line-clamp-2 group-hover:text-primary transition-colors">{event.title}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 shrink-0" />{formatEventDate(event)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-1"><MapPin className="w-3.5 h-3.5 shrink-0" />{formatEventLocation(event)}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState Icon={Calendar} title="No upcoming events listed">Know of a show or trade night? <Link to="/events" className="text-primary font-semibold hover:underline">Submit it on the events page</Link>.</EmptyState>
          )}
        </section>

        {/* ── Collectors + The Parallel Report ── */}
        <div className={`grid gap-10 ${blogEnabled ? 'lg:grid-cols-2' : ''}`}>
          <section aria-labelledby="hub-profiles">
            <SectionHeading
              Icon={Users}
              title={<span id="hub-profiles">New collectors</span>}
              blurb="Collectors who have built a public presence on CardPop."
              to="/community/profiles"
              cta="Browse profiles"
            />
            {profiles.data === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
            ) : profiles.error ? (
              <EmptyState Icon={Users} title="Couldn't load profiles" error>Unable to load profiles right now.</EmptyState>
            ) : profiles.data.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profiles.data.map(profile => (
                  <Link key={profile.id} to={`/community/user/${profile.id}`} className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <ProfileAvatar profile={profile} size="md" name={profile.display_name || 'C'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate">{profile.display_name || 'Collector'}</span>
                        {isVerified(profile.is_verified) && <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" aria-label="Verified" />}
                      </div>
                      {profile.bio && <p className="text-xs text-muted-foreground line-clamp-1">{profile.bio}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState Icon={Users} title="No public profiles yet">Collectors will appear here once they set up a public profile.</EmptyState>
            )}
          </section>

          {blogEnabled && (
            <section aria-labelledby="hub-reads">
              <SectionHeading
                Icon={READS_ITEM.Icon}
                title={<span id="hub-reads">From The Parallel Report</span>}
                blurb="Guides, news and card stories from the CardPop desk."
                to="/blog"
                cta="All articles"
              />
              {articles.data === null ? (
                <div className="space-y-3">{Array(ARTICLES_LIMIT).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
              ) : articles.error ? (
                <EmptyState Icon={READS_ITEM.Icon} title="Couldn't load articles" error>Unable to load articles right now.</EmptyState>
              ) : articles.data.length > 0 ? (
                <div className="space-y-3">
                  {articles.data.map(article => (
                    <Link
                      key={article.id}
                      to={`/blog/${article.slug || article.id}`}
                      className="group flex gap-4 bg-card border border-border p-4 rounded-2xl hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      {article.featured_image_url && (
                        <img src={article.featured_image_url} alt="" loading="lazy" className="w-20 h-20 rounded-xl object-cover shrink-0 border border-border" />
                      )}
                      <div className="min-w-0">
                        {article.category && <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold mb-1.5">{article.category}</Badge>}
                        <h3 className="font-bold line-clamp-2 group-hover:text-primary transition-colors">{article.title}</h3>
                        {article.excerpt && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{article.excerpt}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState Icon={READS_ITEM.Icon} title="No articles yet">The first Parallel Report articles are on their way.</EmptyState>
              )}
            </section>
          )}
        </div>

        {/* ── Retailers & Suppliers ── */}
        <section aria-labelledby="hub-retailers">
          <SectionHeading
            Icon={Store}
            title={<span id="hub-retailers">Retailers &amp; suppliers</span>}
            blurb="Authorized retailers and suppliers trusted by the CardPop community."
            to="/community/local-traders"
            cta="Local traders near you"
          />
          {retailers.data === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
          ) : retailers.error ? (
            <EmptyState Icon={Store} title="Couldn't load retailers" error>Unable to load retailers right now.</EmptyState>
          ) : retailers.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {retailers.data.map(retailer => (
                <div key={retailer.id} className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {retailer.logo_url ? (
                      <img src={retailer.logo_url} alt={retailer.business_name} className="h-12 w-12 rounded-xl object-cover border border-border flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Store className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{retailer.business_name}</p>
                      {retailer.business_type && <Badge variant="outline" className="text-xs mt-0.5">{retailer.business_type}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{retailer.tagline || retailer.about || 'Authorized CardPop partner.'}</p>
                  {retailer.website_url && (
                    <Button variant="outline" size="sm" className="mt-auto gap-1.5" onClick={() => window.open(retailer.website_url, '_blank', 'noopener')}>
                      <ExternalLink className="w-3.5 h-3.5" /> Visit Store
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState Icon={Store} title="No retailers listed yet">Authorized retailers and suppliers will appear here once added.</EmptyState>
          )}
        </section>

        {/* ── For sellers ── */}
        <section aria-labelledby="hub-sellers">
          <h2 id="hub-sellers" className="text-xl sm:text-2xl font-bold flex items-center gap-2 mb-5">
            <Rocket className="w-5 h-5 text-primary shrink-0" aria-hidden="true" /> For sellers
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to="/community/building-your-business"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-brand-red/[0.06] via-card to-brand-charcoal/[0.06] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground">Building Your Business</h3>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">Sellers</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">The tools we use and recommend to grow a card business — payments, live selling, email, socials and more.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
            <Link
              to="/community/whatnot"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                <WhatnotIcon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground">Whatnot Shows</h3>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">Live</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">Watch live breaks and auctions from Australian sellers — or list your own show before you go live.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          </div>
        </section>
      </div>

      {/* ── Promo Carousel ── */}
      <section
        className="relative overflow-hidden min-h-[380px] sm:min-h-[400px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slide 1 — Free Trial */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${currentSlide === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="relative h-full overflow-hidden text-white flex flex-col items-center justify-center px-5 pb-16 pt-12 text-center"
            style={{ background: 'linear-gradient(135deg, #1F2937 0%, #7F131F 58%, #CE1126 100%)' }}>
            {/* Diagonal accent slabs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -right-24 top-0 w-72 h-full bg-white/5" style={{ transform: 'skewX(-12deg)' }} />
              <div className="absolute -right-4 top-0 w-40 h-full bg-white/[0.04]" style={{ transform: 'skewX(-12deg)' }} />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-4 max-w-2xl">
              <span className="bg-white text-brand-red font-heading font-extrabold text-xs px-4 py-1.5 uppercase tracking-[0.2em] rounded-pill shadow-sm">
                Limited Time
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold leading-[1.05] uppercase tracking-tight">
                30 Days Free.<br />Cancel Anytime.
              </h2>
              <div className="w-12 h-1 bg-white/40 rounded-full" />
              <p className="text-white/80 text-sm sm:text-base max-w-md leading-relaxed">
                List and sell your cards free for 30 days. Add a card to start — cancel anytime before your trial ends and you won't be charged.
              </p>
              <Link
                to="/signup"
                className="mt-1 inline-flex items-center gap-2 bg-white text-brand-red font-heading font-extrabold text-sm px-8 py-3.5 uppercase tracking-[0.15em] rounded-button hover:bg-white/90 transition-colors shadow-lg"
              >
                Start Free Trial <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Slide 2 — Whatnot Shows */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${currentSlide === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="relative h-full overflow-hidden bg-black text-white flex flex-col items-center justify-center px-5 pb-16 pt-12 text-center">
            {/* Yellow diagonal accent */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -left-16 top-0 w-56 h-full bg-yellow-400/[0.08]" style={{ transform: 'skewX(-12deg)' }} />
              <div className="absolute left-32 top-0 w-24 h-full bg-yellow-400/5" style={{ transform: 'skewX(-12deg)' }} />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-4 max-w-2xl">
              <div className="flex items-center gap-3">
                <WhatnotIcon className="w-10 h-10" />
                <span className="bg-yellow-400 text-black font-heading font-extrabold text-xs px-4 py-1.5 uppercase tracking-[0.2em] rounded-pill shadow-sm">
                  Go Live
                </span>
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold leading-[1.05] uppercase tracking-tight"
                style={{ textShadow: '0 0 60px rgba(250,204,21,0.25)' }}>
                Promote Your<br />Whatnot Shows
              </h2>
              <div className="w-12 h-1 bg-yellow-400/60 rounded-full" />
              <p className="text-white/70 text-sm sm:text-base max-w-md leading-relaxed">
                Got live pack breaks and auctions? Sign up and list your shows on CardPop — reach Australian collectors before you go live.
              </p>
              <Link
                to="/signup"
                className="mt-1 inline-flex items-center gap-2 bg-yellow-400 text-black font-heading font-extrabold text-sm px-8 py-3.5 uppercase tracking-[0.15em] rounded-button hover:bg-yellow-300 transition-colors shadow-lg"
              >
                Add Your Show <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Slide 3 — Instagram / Socials */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${currentSlide === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="relative h-full overflow-hidden text-white flex flex-col items-center justify-center px-5 pb-16 pt-12 text-center"
            style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #be185d 50%, #ea580c 100%)' }}>
            {/* Diagonal accents */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -right-20 top-0 w-64 h-full bg-white/5" style={{ transform: 'skewX(-12deg)' }} />
              <div className="absolute right-36 top-0 w-20 h-full bg-white/[0.04]" style={{ transform: 'skewX(-12deg)' }} />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-4 max-w-2xl">
              <span className="border-2 border-white/50 text-white font-heading font-extrabold text-xs px-4 py-1.5 uppercase tracking-[0.2em] rounded-pill">
                Connect
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold leading-[1.05] uppercase tracking-tight"
                style={{ textShadow: '0 2px 30px rgba(0,0,0,0.35)' }}>
                Share Your Pulls.<br />Build Your Name.
              </h2>
              <div className="w-12 h-1 bg-white/40 rounded-full" />
              <p className="text-white/85 text-sm sm:text-base max-w-md leading-relaxed">
                Link your Instagram to your CardPop profile. Get discovered, share your collection, and connect with breakers across Australia.
              </p>
              <Link
                to="/signup"
                className="mt-1 inline-flex items-center gap-2 bg-white text-pink-700 font-heading font-extrabold text-sm px-8 py-3.5 uppercase tracking-[0.15em] rounded-button hover:bg-white/90 transition-colors shadow-lg"
              >
                Build Your Profile <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Prev Arrow */}
        <button
          onClick={prevSlide}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-sm p-2 transition-colors backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Arrow */}
        <button
          onClick={nextSlide}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-sm p-2 transition-colors backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`h-1.5 rounded-sm transition-all duration-300 ${i === currentSlide ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/65'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default CommunityPage;
