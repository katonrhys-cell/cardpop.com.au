import React, { useEffect, useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { MessageSquare, Users, Store, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight, Instagram } from 'lucide-react';

const WhatnotIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
    <rect width="32" height="32" rx="8" fill="#000000" />
    <path
      d="M5 9l4.5 14 4-9.5 2.5 5.5 2.5-5.5 4 9.5L27 9"
      stroke="#FFDF00"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const TOTAL_SLIDES = 3;

const CommunityPage = () => {
  const navigate = useNavigate();
  const [discussions, setDiscussions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingRetailers, setLoadingRetailers] = useState(true);
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

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('posts')
      .select('*')
      .eq('post_type', 'text')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (!cancelled) setDiscussions(data || []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingDiscussions(false); });

    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (!cancelled) setProfiles(data || []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingProfiles(false); });

    supabase
      .from('business_profiles')
      .select('*')
      .eq('is_active', true)
      .order('brand_name', { ascending: true })
      .then(({ data }) => { if (!cancelled) setRetailers(data || []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingRetailers(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Community Hub | CardPop" description="Connect with Australian trading card collectors. Join discussions, share your collection and trade cards on CardPop." />

      {/* ── Hero Carousel ── */}
      <section
        className="relative overflow-hidden min-h-[300px] sm:min-h-[340px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slide 1 — Free Trial */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${currentSlide === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="relative h-full bg-gradient-to-r from-brand-blue via-blue-600 to-indigo-700 text-white flex flex-col items-center justify-center px-4 py-12 text-center">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 25% 40%, white 1px, transparent 1px), radial-gradient(circle at 75% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />
            <div className="relative z-10 flex flex-col items-center gap-3 max-w-2xl">
              <div className="bg-white/20 rounded-full p-3">
                <Users className="w-8 h-8 text-white" />
              </div>
              <span className="bg-white text-brand-blue font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wide">
                Limited Offer
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                30 Days Free Trading — No Credit Card Required
              </h2>
              <p className="text-white/85 text-sm sm:text-base">
                Local traders can list and sell cards on CardPop completely free for 30 days. Join Australia's fastest-growing trading card community today.
              </p>
              <Link
                to="/signup"
                className="mt-2 bg-white text-brand-blue font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
              >
                Register Free
              </Link>
            </div>
          </div>
        </div>

        {/* Slide 2 — Whatnot Shows */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${currentSlide === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="relative h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white flex flex-col items-center justify-center px-4 py-12 text-center">
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle, #FFDF00 1px, transparent 1px)', backgroundSize: '30px 30px' }}
            />
            <div className="relative z-10 flex flex-col items-center gap-3 max-w-2xl">
              <WhatnotIcon className="w-14 h-14" />
              <span className="bg-yellow-400 text-black font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wide">
                Go Live on Whatnot
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                Promote Your Whatnot Shows &amp; Breaks
              </h2>
              <p className="text-white/80 text-sm sm:text-base">
                Got live pack breaks and auctions? Sign up and list your Whatnot shows on CardPop to get discovered by thousands of Australian collectors.
              </p>
              <Link
                to="/signup"
                className="mt-2 bg-yellow-400 text-black font-bold text-sm px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors shadow-lg"
              >
                Sign Up &amp; Promote Your Show
              </Link>
            </div>
          </div>
        </div>

        {/* Slide 3 — Instagram / Socials */}
        <div className={`absolute inset-0 transition-opacity duration-700 ${currentSlide === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <div className="relative h-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white flex flex-col items-center justify-center px-4 py-12 text-center">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 30% 60%, white 1px, transparent 1px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '35px 35px' }}
            />
            <div className="relative z-10 flex flex-col items-center gap-3 max-w-2xl">
              <div className="bg-white/20 rounded-full p-3">
                <Instagram className="w-8 h-8 text-white" />
              </div>
              <span className="border border-white/40 bg-white/20 text-white font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wide">
                Connect
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                Share Your Collection on Instagram
              </h2>
              <p className="text-white/85 text-sm sm:text-base">
                Link your Instagram to your CardPop profile. Get discovered, share your pulls, and connect with collectors and breakers across Australia.
              </p>
              <Link
                to="/signup"
                className="mt-2 bg-white text-pink-600 font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-colors shadow-lg"
              >
                Build Your Collector Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Prev Arrow */}
        <button
          onClick={prevSlide}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-colors"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Arrow */}
        <button
          onClick={nextSlide}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-colors"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Tabs defaultValue="forum">
          <TabsList className="w-full mb-8 h-12 overflow-x-auto flex-nowrap">
            <TabsTrigger value="forum" className="flex-1 gap-2">
              <MessageSquare className="w-4 h-4" /> Forum
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex-1 gap-2">
              <Users className="w-4 h-4" /> Public Profiles
            </TabsTrigger>
            <TabsTrigger value="retailers" className="flex-1 gap-2">
              <Store className="w-4 h-4" /> Retailers &amp; Suppliers
            </TabsTrigger>
            <TabsTrigger value="whatnot" className="flex-1 gap-2" onClick={() => navigate('/community/whatnot')}>
              <WhatnotIcon className="w-4 h-4" /> Whatnot
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
