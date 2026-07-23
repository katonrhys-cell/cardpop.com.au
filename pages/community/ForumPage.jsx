import React, { useEffect, useState, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Search, TrendingUp, Clock, Plus, Flame, Pin } from 'lucide-react';
import { publicImageUrl } from '@/utils/imageUrl.js';

const CATEGORIES = ['All', 'General', 'Trading', 'Grading', 'Market Talk', 'Buying Advice', 'Show & Tell', 'Events'];

const CATEGORY_COLORS = {
  General:        'from-slate-500 to-zinc-600',
  Trading:        'from-blue-500 to-indigo-600',
  Grading:        'from-purple-500 to-violet-600',
  'Market Talk':  'from-amber-500 to-orange-500',
  'Buying Advice':'from-green-500 to-emerald-600',
  'Show & Tell':  'from-pink-500 to-rose-500',
  Events:         'from-cyan-500 to-sky-600',
};

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const ForumPage = () => {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('posts')
        .select('*, profiles:author_id(id, display_name, avatar_url, profile_photo_or_character)')
        .eq('post_type', 'text')
        .order('created_at', { ascending: false })
        .limit(40);

      if (activeCategory !== 'All') query = query.eq('category', activeCategory);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to load discussions:', err);
      setError('Unable to load discussions right now. Please try again shortly.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filtered = search.trim()
    ? posts.filter(p => (p.title || '').toLowerCase().includes(search.toLowerCase()))
    : posts;

  const resolveAvatar = (profile) => {
    const raw = profile?.avatar_url || profile?.profile_photo_or_character;
    if (!raw) return null;
    return publicImageUrl(raw);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Community Forum | CardPop"
        description="Join discussions with Australian trading card collectors. Talk market trends, trading, grading and more on CardPop."
      />

      <div className="container-default pt-6">
        <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Community', path: '/community' }, { label: 'Forum' }]} />
      </div>

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 mb-6 shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Community Forum</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Share insights, ask questions and connect with collectors across Australia. Every collector's voice matters here.
          </p>
          {isAuthenticated && (
            <Button asChild className="mt-6 rounded-xl font-bold gap-2 shadow-sm">
              <Link to="/community/discussion/new">
                <Plus className="w-4 h-4" /> Start a Discussion
              </Link>
            </Button>
          )}
          {!isAuthenticated && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button asChild className="rounded-xl font-bold gap-2 shadow-sm">
                <Link to="/signup">Join to Post</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl font-bold">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10">

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search discussions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Discussions', value: loading ? '—' : filtered.length, Icon: MessageSquare, color: 'text-violet-500' },
            { label: 'Trending',    value: 'Hot topics', Icon: Flame,          color: 'text-orange-500' },
            { label: 'Latest',      value: 'New today',  Icon: Clock,          color: 'text-sky-500'    },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-lg font-extrabold text-foreground">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Discussion list */}
        <div className="space-y-3">
          {loading ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-destructive/20 border-dashed">
              <MessageSquare className="w-14 h-14 text-destructive mb-4 opacity-40" />
              <p className="text-foreground text-xl font-bold mb-2">Couldn't load discussions</p>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Button onClick={fetchPosts} variant="outline" className="rounded-xl font-bold">
                Try again
              </Button>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map(post => {
              const profile = post.profiles;
              const categoryColor = CATEGORY_COLORS[post.category] || 'from-slate-500 to-zinc-600';
              return (
                <Link
                  key={post.id}
                  to={`/community/discussion/${post.id}`}
                  className="block bg-card border border-border p-5 rounded-2xl hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {/* Category badge */}
                    <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${categoryColor} shrink-0 shadow-sm mt-0.5`}>
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors">
                          {post.title || 'Untitled Discussion'}
                        </h3>
                        {post.is_pinned && <Pin className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                      </div>

                      {post.body && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                          {post.body}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {post.category && (
                          <Badge variant="secondary" className="text-[11px] font-semibold">
                            {post.category}
                          </Badge>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {post.replies?.length || 0} replies
                        </span>
                        {post.views > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {post.views} views
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          {profile && (
                            <>
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={resolveAvatar(profile)} />
                                <AvatarFallback className="text-[9px]">
                                  {(profile.display_name || 'C').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{profile.display_name || 'Collector'}</span>
                              <span>·</span>
                            </>
                          )}
                          {post.created_at && timeAgo(post.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-border border-dashed">
              <MessageSquare className="w-14 h-14 text-muted-foreground mb-4 opacity-40" />
              <p className="text-foreground text-xl font-bold mb-2">
                {search ? 'No matching discussions' : 'No discussions yet'}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {search ? 'Try a different search term.' : 'Be the first to start a conversation!'}
              </p>
              {isAuthenticated && !search && (
                <Button asChild className="rounded-xl font-bold gap-2">
                  <Link to="/community/discussion/new">
                    <Plus className="w-4 h-4" /> Start a Discussion
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SEO footer */}
      <section className="border-t border-border bg-muted/30 py-14 mt-10">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 text-center">
          <h2 className="text-2xl font-bold mb-3">Australia's Trading Card Community</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            CardPop's community forum connects collectors across Australia to discuss market trends,
            grading, trading, and everything in between. Whether you're a seasoned collector or just
            starting out, there's a place for you here.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ForumPage;
