import React, { useEffect, useState } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { isVerified } from '@/utils/verification.js';
import { MessageSquare, Users, Store, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight, Instagram, Rocket, ArrowRight } from 'lucide-react';

import WhatnotIcon from '@/components/WhatnotIcon.jsx';
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
  const [discussionsError, setDiscussionsError] = useState(null);
  const [profilesError, setProfilesError] = useState(null);
  const [retailersError, setRetailersError] = useState(null);
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
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setDiscussionsError('Unable to load discussions right now.'); return; }
        setDiscussions(data || []);
      })
      .catch(() => { if (!cancelled) setDiscussionsError('Unable to load discussions right now.'); })
      .finally(() => { if (!cancelled) setLoadingDiscussions(false); });

    supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setProfilesError('Unable to load profiles right now.'); return; }
        // Deduplicate by user id to prevent duplicates
        const seen = new Set();
        const uniqueProfiles = (data || []).filter(profile => {
          if (seen.has(profile.id)) return false;
          seen.add(profile.id);
          return true;
        });
        setProfiles(uniqueProfiles);
      })
      .catch(() => { if (!cancelled) setProfilesError('Unable to load profiles right now.'); })
      .finally(() => { if (!cancelled) setLoadingProfiles(false); });

    supabase
      .from('business_profiles')
      .select('*')
      .eq('storefront_status', 'approved')
      .order('business_name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setRetailersError('Unable to load retailers right now.'); return; }
        setRetailers(data || []);
      })
      .catch(() => { if (!cancelled) setRetailersError('Unable to load retailers right now.'); })
      .finally(() => { if (!cancelled) setLoadingRetailers(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Community Hub | CardPop" description="Connect with Australian trading card collectors. Join discussions, share your collection and trade cards on CardPop." />

      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <Users className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The Collector's Hub</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discuss market trends, connect with verified collectors, and discover authorized retailers shaping the hobby.
          </p>
        </div>
      </section>

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
                Got live pack breaks and auctions? Sign up and list your shows on CardPop — reach thousands of Australian collectors.
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

        {/* Dots — kept above the angled divider overlap */}
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

      {/* Angled edge below carousel */}
      <div
        aria-hidden="true"
        className="relative -mt-4 h-4 z-10 bg-background pointer-events-none"
        style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }}
      />

      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Building Your Business promo ── */}
        <Link
          to="/community/building-your-business"
          className="group flex items-center gap-4 sm:gap-5 mb-10 rounded-2xl border border-border bg-gradient-to-br from-brand-red/[0.06] via-card to-brand-blue/[0.06] p-5 sm:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
            <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Building Your Business</h2>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">Sellers</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              The tools we use and recommend to grow a card business — payments, live selling, email, socials and more.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>

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
              <Button asChild size="sm"><Link to="/community/discussion/new">Start a Discussion</Link></Button>
            </div>
            <div className="space-y-4">
              {loadingDiscussions ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
              ) : discussionsError ? (
                <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-destructive/20 border-dashed">
                  <MessageSquare className="w-12 h-12 text-destructive mb-4 opacity-40" />
                  <p className="text-foreground text-xl font-bold mb-2">Couldn't load discussions</p>
                  <p className="text-sm text-muted-foreground">{discussionsError}</p>
                </div>
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
            ) : profilesError ? (
              <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-destructive/20 border-dashed">
                <Users className="w-12 h-12 text-destructive mb-4 opacity-40" />
                <p className="text-foreground text-xl font-bold mb-2">Couldn't load profiles</p>
                <p className="text-sm text-muted-foreground">{profilesError}</p>
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
                            {isVerified(profile.is_verified) && (
                              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                          {isVerified(profile.is_verified) && (
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
            ) : retailersError ? (
              <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-destructive/20 border-dashed">
                <Store className="w-12 h-12 text-destructive mb-4 opacity-40" />
                <p className="text-foreground text-xl font-bold mb-2">Couldn't load retailers</p>
                <p className="text-sm text-muted-foreground">{retailersError}</p>
              </div>
            ) : retailers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {retailers.map(retailer => (
                  <div key={retailer.id} className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {retailer.logo_url ? (
                        <img
                          src={retailer.logo_url}
                          alt={retailer.business_name}
                          className="h-12 w-12 rounded-xl object-cover border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Store className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{retailer.business_name}</p>
                        {retailer.business_type && (
                          <Badge variant="outline" className="text-xs mt-0.5">{retailer.business_type}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {retailer.tagline || retailer.about || 'Authorized CardPop partner.'}
                    </p>
                    {retailer.website_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-auto gap-1.5"
                        onClick={() => window.open(retailer.website_url, '_blank')}
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
