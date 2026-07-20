import React, { useEffect, useState, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { isVerified } from '@/utils/verification.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Search, ShieldCheck, Star, UserPlus, Package } from 'lucide-react';
import { publicImageUrl } from '@/utils/imageUrl.js';

const FILTERS = ['All', 'Verified'];

const ProfilesPage = () => {
  const { isAuthenticated } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(60);

      if (activeFilter === 'Verified') query = query.eq('is_verified', true);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Deduplicate by user id to prevent duplicates
      const seen = new Set();
      const uniqueProfiles = (data || []).filter(profile => {
        if (seen.has(profile.id)) return false;
        seen.add(profile.id);
        return true;
      });

      setProfiles(uniqueProfiles);
    } catch (err) {
      console.error('Failed to load member profiles:', err);
      setError('Unable to load member profiles right now. Please try again shortly.');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const filtered = search.trim()
    ? profiles.filter(p =>
        (p.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.username || '').toLowerCase().includes(search.toLowerCase())
      )
    : profiles;

  const resolveAvatar = (profile) => {
    const raw = profile?.avatar_url || profile?.business_logo_url || profile?.profile_photo_or_character;
    if (!raw) return null;
    return publicImageUrl(raw);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Collector Profiles | CardPop Community"
        description="Browse verified trading card collectors on CardPop. Find fellow hobbyists, traders and sellers across Australia."
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 mb-6 shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Collector Profiles</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover verified collectors, seasoned traders and passionate hobbyists building their
            collections across Australia.
          </p>
          {!isAuthenticated && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button asChild className="rounded-xl font-bold gap-2 shadow-sm">
                <Link to="/signup">
                  <UserPlus className="w-4 h-4" /> Create Your Profile
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl font-bold">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          )}
          {isAuthenticated && (
            <Button asChild variant="outline" className="mt-6 rounded-xl font-bold gap-2">
              <Link to="/account/profile">
                <UserPlus className="w-4 h-4" /> Edit Your Profile
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10">

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search collectors by name or username…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFilter === f
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!loading && !error && (
          <p className="text-sm text-muted-foreground mb-6 font-medium">
            {filtered.length} collector{filtered.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(9).fill(0).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-destructive/20 border-dashed">
            <Users className="w-14 h-14 text-destructive mb-4 opacity-40" />
            <p className="text-foreground text-xl font-bold mb-2">Couldn't load profiles</p>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchProfiles} variant="outline" className="rounded-xl font-bold">
              Try again
            </Button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(profile => {
              const avatarUrl = resolveAvatar(profile);
              const profileVerified = isVerified(profile.is_verified);
              const name = profile.display_name || profile.username || 'Collector';

              return (
                <div
                  key={profile.id}
                  className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-border group-hover:ring-primary/30 transition-all">
                      <AvatarImage src={avatarUrl} className="object-cover" />
                      <AvatarFallback className="font-bold text-base">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="font-bold truncate text-sm">{name}</span>
                        {profileVerified && <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {profileVerified && (
                          <Badge className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20 px-1.5 py-0">
                            Verified
                          </Badge>
                        )}
                        {profile.rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500 font-bold">
                            <Star className="w-3 h-3 fill-amber-500" />
                            {Number(profile.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {profile.personal_collection && (
                    <div className="flex items-start gap-1.5 text-xs">
                      <Package className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground/90 line-clamp-2 leading-relaxed">
                        <span className="font-bold text-primary">PC:</span> {profile.personal_collection}
                      </span>
                    </div>
                  )}

                  {profile.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}

                  {(profile.collection_count > 0 || profile.listings_count > 0) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      {profile.collection_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="w-3.5 h-3.5" />
                          {profile.collection_count} cards
                        </span>
                      )}
                      {profile.listings_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3.5 h-3.5" />
                          {profile.listings_count} listings
                        </span>
                      )}
                    </div>
                  )}

                  <Button asChild variant="outline" size="sm" className="mt-auto rounded-xl font-bold text-xs">
                    <Link to={`/community/user/${profile.id}`}>View Profile</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-border border-dashed">
            <Users className="w-14 h-14 text-muted-foreground mb-4 opacity-40" />
            <p className="text-foreground text-xl font-bold mb-2">
              {search ? 'No matching profiles' : 'No public profiles yet'}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {search
                ? 'Try a different name or username.'
                : 'Collectors will appear here once they set up a public profile.'}
            </p>
            {!isAuthenticated && (
              <Button asChild className="rounded-xl font-bold gap-2">
                <Link to="/signup">
                  <UserPlus className="w-4 h-4" /> Create Your Profile
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* SEO footer */}
      <section className="border-t border-border bg-muted/30 py-14 mt-10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 text-center">
          <h2 className="text-2xl font-bold mb-3">Meet Australia's Collectors</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            CardPop is home to thousands of Australian trading card collectors. Browse verified profiles,
            find traders who specialise in your favourite games, and connect with the community.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ProfilesPage;
