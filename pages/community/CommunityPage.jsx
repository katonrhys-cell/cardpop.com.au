import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { MessageSquare, Users, Store, ExternalLink, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CommunityPage = () => {
  const [discussions, setDiscussions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingRetailers, setLoadingRetailers] = useState(true);

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .eq('post_type', 'text')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setDiscussions(data || []))
      .catch(console.error)
      .finally(() => setLoadingDiscussions(false));

    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setProfiles(data || []))
      .catch(console.error)
      .finally(() => setLoadingProfiles(false));

    supabase
      .from('business_profiles')
      .select('*')
      .eq('is_active', true)
      .order('brand_name', { ascending: true })
      .then(({ data }) => setRetailers(data || []))
      .catch(console.error)
      .finally(() => setLoadingRetailers(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Community Hub | CardPop</title></Helmet>

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Users className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Collector's Hub</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discuss market trends, connect with verified collectors, and discover authorized retailers shaping the hobby.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Tabs defaultValue="forum">
          <TabsList className="w-full mb-8 h-12">
            <TabsTrigger value="forum" className="flex-1 gap-2">
              <MessageSquare className="w-4 h-4" /> Forum
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex-1 gap-2">
              <Users className="w-4 h-4" /> Public Profiles
            </TabsTrigger>
            <TabsTrigger value="retailers" className="flex-1 gap-2">
              <Store className="w-4 h-4" /> Retailers &amp; Suppliers
            </TabsTrigger>
          </TabsList>

          {/* ── Forum ── */}
          <TabsContent value="forum">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Recent Discussions</h2>
              <Button size="sm">Start a Discussion</Button>
            </div>
            <div className="space-y-4">
              {loadingDiscussions ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
              ) : discussions.length > 0 ? (
                discussions.map(post => (
                  <Link
                    key={post.id}
                    to={`/community/discussion/${post.id}`}
                    className="block bg-card border border-border p-6 rounded-2xl hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <h3 className="font-bold text-lg mb-2">{post.title || 'Untitled Discussion'}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" />
                        {post.replies?.length || 0} replies
                      </span>
                      <Badge variant="secondary">{post.category || 'General'}</Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-border border-dashed">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-foreground text-xl font-bold mb-2">No discussions yet</p>
                  <p className="text-sm text-muted-foreground">Be the first to start a conversation!</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Public Profiles ── */}
          <TabsContent value="profiles">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">Verified Collectors</h2>
              <p className="text-muted-foreground text-sm">
                Collectors who have built a public presence on CardPop.
              </p>
            </div>
            {loadingProfiles ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
              </div>
            ) : profiles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map(profile => {
                  const avatarUrl = profile.avatar_url || profile.profile_photo_or_character || null;
                  return (
                    <div key={profile.id} className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={avatarUrl} className="object-cover" />
                          <AvatarFallback>
                            {(profile.display_name || 'C').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold truncate">{profile.display_name || 'Collector'}</span>
                            {profile.is_verified === 'true' && (
                              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                          {profile.is_verified === 'true' && (
                            <Badge variant="secondary" className="text-xs">Verified</Badge>
                          )}
                        </div>
                      </div>
                      {profile.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-border border-dashed">
                <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-foreground text-xl font-bold mb-2">No public profiles yet</p>
                <p className="text-sm text-muted-foreground">
                  Collectors will appear here once they set up a public profile.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Retailers & Suppliers ── */}
          <TabsContent value="retailers">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">Retailers &amp; Suppliers</h2>
              <p className="text-muted-foreground text-sm">
                Authorized retailers and suppliers trusted by the CardPop community.
              </p>
            </div>
            {loadingRetailers ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
              </div>
            ) : retailers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {retailers.map(retailer => (
                  <div key={retailer.id} className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {retailer.logo_url ? (
                        <img
                          src={retailer.logo_url}
                          alt={retailer.brand_name}
                          className="h-12 w-12 rounded-xl object-cover border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Store className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{retailer.brand_name}</p>
                        {retailer.category && (
                          <Badge variant="outline" className="text-xs mt-0.5">{retailer.category}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {retailer.description || 'Authorized CardPop partner.'}
                    </p>
                    {retailer.affiliate_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-auto gap-1.5"
                        onClick={() => window.open(retailer.affiliate_link, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Visit Store
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-border border-dashed">
                <Store className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-foreground text-xl font-bold mb-2">No retailers listed yet</p>
                <p className="text-sm text-muted-foreground">
                  Authorized retailers and suppliers will appear here once added.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CommunityPage;
