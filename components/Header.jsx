
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Menu, Shield, MessageSquare, ArrowRightLeft, Sun, Moon, Tag,
} from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { useIsDesktop } from '@/hooks/useIsDesktop.js';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import SearchBar from '@/components/SearchBar.jsx';
// Lazy-loaded: only rendered for authenticated users, and it pulls in date-fns.
// Keeping it out of the static graph keeps date-fns off the anonymous critical path.
const NotificationBell = lazy(() => import('@/components/NotificationBell.jsx'));
// Also authed-only, and it pulls @radix-ui/react-menu + floating-ui (~97 kB of
// source). Lazy-loading keeps that off the anonymous homepage's critical path.
const VaultDropdown = lazy(() => import('@/components/VaultDropdown.jsx'));

// The desktop mega-dropdowns and the mobile Sheet menu body are the Header's
// heaviest JS (CategoryIcons + ~35 lucide icons + all the nav data). None of it
// is needed for the first paint of the header bar, so it lives in its own async
// chunk. On phones the desktop nav is gated out entirely (see useIsDesktop), and
// the mobile menu only loads when the hamburger is opened.
const DesktopNavMenus = lazy(() => import('@/components/HeaderMenus.jsx').then(m => ({ default: m.DesktopNavMenus })));
const MobileNavMenus = lazy(() => import('@/components/HeaderMenus.jsx').then(m => ({ default: m.MobileNavMenus })));

const prefetchMenus = () => import('@/components/HeaderMenus.jsx');

export const TCG_COLLECTIONS = [
  'Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh', 'Digimon',
  'Riftbound', 'TMNT', 'Final Fantasy', 'Disney Lorcana', 'One Piece',
  'Flesh and Blood', 'Dragon Ball Super', 'Star Wars Unlimited',
  'Weiss Schwarz', 'Cardfight!! Vanguard',
];

export const SPORTS_COLLECTIONS = [
  'NBA', 'NFL', 'MLB', 'Cricket', 'NRL', 'NHL', 'Formula 1',
  'Wrestling', 'Golf', 'Soccer', 'AFL', 'AFLW', 'Rugby Union',
  'Boxing', 'MMA', 'Tennis', 'UFC',
];

export const COLLECTIONS_LIST = [...TCG_COLLECTIONS, ...SPORTS_COLLECTIONS].sort();

const Header = () => {
  const { isAuthenticated, currentUser, isAdmin, logout, isVerified, loading: authLoading } = useAuth();
  const { settings } = usePlatformSettings();
  const { cartItems, setIsCartOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  // Read cached session from localStorage so the skeleton matches the expected auth state,
  // preventing a layout shift when auth resolves and replaces the wrong-sized placeholder.
  const [optimisticAuth] = useState(() => {
    try { return !!localStorage.getItem('sb-odoglvswwymyjuwlonkf-auth-token'); }
    catch { return false; }
  });
  const { isDark, toggle: toggleDarkMode } = useDarkMode();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Warm the nav-menus chunk on the user's first interaction so opening the
  // hamburger (or first hover on desktop) is instant. Mirrors ShoppingCartLazy:
  // a visitor can't reach these menus without interacting first, so this pulls
  // nothing onto the initial load window.
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      for (const evt of events) window.removeEventListener(evt, warm);
      prefetchMenus();
    };
    for (const evt of events) window.addEventListener(evt, warm, { once: true, passive: true });
    return () => { for (const evt of events) window.removeEventListener(evt, warm); };
  }, []);

  // Failsafe: Radix Dialog/Sheet uses @radix-ui/react-remove-scroll which sets
  // overflow:hidden (and sometimes pointer-events:none) on <body> while open.
  // If the user navigates away while a Dialog/Sheet is open (e.g. VaultListingModal),
  // the component unmounts mid-animation and leaves stale body styles behind.
  // This causes the next page's scroll to be locked at the previous page's position,
  // making the new page appear blank even though it rendered correctly.
  useEffect(() => {
    const clearStaleBodyStyles = () => {
      const hasOpenLayer = document.querySelector('[data-state="open"][role="dialog"]');
      if (!hasOpenLayer) {
        if (document.body.style.pointerEvents === 'none') document.body.style.pointerEvents = '';
        if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
        if (document.body.style.paddingRight) document.body.style.paddingRight = '';
      }
    };

    // Watch for any style change on body and fix it after animations settle.
    // Debounce into a single tracked timeout so rapid mutations don't pile up
    // and so the pending timeout can be cancelled on unmount (otherwise it can
    // fire after the component/document is gone).
    let settleTimeout = null;
    const observer = new MutationObserver(() => {
      clearTimeout(settleTimeout);
      settleTimeout = setTimeout(clearStaleBodyStyles, 350);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });

    // Periodic sweep as a last resort (500ms is imperceptible to users)
    const interval = setInterval(clearStaleBodyStyles, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(settleTimeout);
    };
  }, []);

  // Clear stale body styles immediately on every route change, and again after
  // 400ms to catch anything that the close animation set after the route changed.
  useEffect(() => {
    const clearStaleBodyStyles = () => {
      const hasOpenLayer = document.querySelector('[data-state="open"][role="dialog"]');
      if (!hasOpenLayer) {
        if (document.body.style.pointerEvents === 'none') document.body.style.pointerEvents = '';
        if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
        if (document.body.style.paddingRight) document.body.style.paddingRight = '';
      }
    };
    clearStaleBodyStyles();
    const timer = setTimeout(clearStaleBodyStyles, 400);
    return () => clearTimeout(timer);
  }, [location.pathname, mobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Reset counts up-front so a previous user's badges don't linger after
    // logout or when a different user signs in on the same tab (the new
    // user's query may not have resolved yet, and could even error).
    setUnreadCount(0);
    setTradeCount(0);
    if (!isAuthenticated || !currentUser) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        const [{ count: msgCount }, { count: tradeCount }] = await Promise.all([
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', currentUser.id)
            .is('read_at', null),
          supabase
            .from('trades')
            .select('*', { count: 'exact', head: true })
            .eq('responder_id', currentUser.id)
            .eq('status', 'proposed')
        ]);
        if (isMounted) {
          setUnreadCount(msgCount || 0);
          setTradeCount(tradeCount || 0);
        }
      } catch (err) {
        console.error("Failed to fetch notification counts:", err);
      }
    };

    fetchData();

    // Scope realtime to THIS user's rows (and use per-user channel names).
    // Previously these subscribed to every row of messages/trades, so any
    // write anywhere on the platform woke every connected client into a double
    // count refetch — load that scaled with users × global write rate.
    const msgChannel = supabase
      .channel(`header-messages-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${currentUser.id}` }, () => fetchData())
      .subscribe();
    const tradeChannel = supabase
      .channel(`header-trades-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `responder_id=eq.${currentUser.id}` }, () => fetchData())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(tradeChannel);
    };
  }, [isAuthenticated, currentUser?.id]);

  const cartItemCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const handleGlobalSearch = (query) => {
    if (query.trim()) {
      // Whole-site search: /search spans marketplace, shop, sellers, guides and
      // events (not just the marketplace, which is what this used to target).
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setMobileMenuOpen(false);
    }
  };

  const handleMobileLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-background/90 backdrop-blur-md shadow-sm border-b border-border'
          : 'bg-background border-b border-border/50'
      }`}
    >
      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">

        {/* ── Row 1: Logo + Search + actions ── */}
        <div className="relative flex items-center py-3 border-b border-border/40">

          <Link
            to="/"
            aria-label="CardPop — back to home"
            className="shrink-0 relative z-10 flex items-center"
            onClick={() => {
              setMobileMenuOpen(false);
              // Already on home: Link won't re-navigate, so scroll back to the top
              if (location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <CardPopLogo variant="full" iconClassName="w-9 h-[44px]" />
          </Link>

          {/* Search — absolutely centred so it always sits at the true visual midpoint */}
          <div className="absolute inset-x-0 hidden lg:flex justify-center pointer-events-none">
            <div className="w-full max-w-xl pointer-events-auto px-4">
              <SearchBar onSearchChange={handleGlobalSearch} placeholder="Search cards, sets, sellers..." />
            </div>
          </div>

          {/* Spacer pushes all action icons to the right edge */}
          <div className="flex-1" />

            {!authLoading && isAdmin && (
              <Button asChild variant="ghost" size="sm" className="hidden xl:flex gap-2 text-[hsl(var(--admin-warning,24.6_95%_53.1%))] hover:text-[hsl(var(--admin-warning,24.6_95%_53.1%))] hover:bg-[hsl(var(--admin-warning,24.6_95%_53.1%))]/10 rounded-xl">
                <Link to="/admin">
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              </Button>
            )}

            {!authLoading && isAuthenticated && settings.enable_trading !== false && (
              <Button asChild variant="ghost" size="icon" className="hidden sm:flex relative rounded-xl hover:bg-muted">
                <Link to="/trade-requests" aria-label={tradeCount > 0 ? `Trade requests, ${tradeCount > 99 ? '99+' : tradeCount} pending` : 'Trade requests'}>
                  <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
                  {tradeCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-accent text-accent-foreground border-none font-bold tabular-nums shadow-sm">
                      {tradeCount > 99 ? '99+' : tradeCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}

            {!authLoading && isAuthenticated && (
              <Button asChild variant="ghost" size="icon" className="hidden sm:flex relative rounded-xl hover:bg-muted">
                <Link to="/messaging" aria-label={unreadCount > 0 ? `Messages, ${unreadCount > 99 ? '99+' : unreadCount} unread` : 'Messages'}>
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-none font-bold tabular-nums shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}

            {!authLoading && isAuthenticated && (
              <div className="hidden sm:block">
                <Suspense fallback={null}>
                  <NotificationBell />
                </Suspense>
              </div>
            )}

            {/* Sell CTA — the primary marketplace action (list a card). Routes to
                the add-card flow; ProtectedRoute prompts login for signed-out
                users. Shown from sm up; on phones it lives in the mobile menu. */}
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex font-bold rounded-xl gap-1.5 shrink-0">
              <Link to="/vault/add">
                <Tag className="h-4 w-4" aria-hidden="true" />
                Sell
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl hover:bg-muted"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleDarkMode}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative shrink-0 rounded-xl hover:bg-muted"
              aria-label="Cart"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-none font-bold tabular-nums shadow-sm">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Badge>
              )}
            </Button>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              {authLoading ? (
                optimisticAuth ? (
                  // Matches the VaultDropdown's h-10 w-10 circular avatar button
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" aria-hidden="true" />
                ) : (
                  // Matches Login + Sign up button exact widths
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <div className="h-9 w-[57px] rounded-xl bg-muted animate-pulse" />
                    <div className="h-9 w-[74px] rounded-xl bg-muted animate-pulse" />
                  </div>
                )
              ) : isAuthenticated ? (
                <Suspense fallback={<div className="h-10 w-10 rounded-full bg-muted animate-pulse" aria-hidden="true" />}>
                  <VaultDropdown isMobile={false} />
                </Suspense>
              ) : (
                <>
                  {/* Login visible whenever this auth cluster is (md+) — it was
                      xl-only, leaving returning users on md–lg screens with no
                      way in except the signup button. */}
                  <Button asChild variant="ghost" size="sm" className="font-bold rounded-xl">
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button asChild size="sm" className="font-bold rounded-xl shadow-sm tracking-wide">
                    <Link to="/signup">Sign up</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden shrink-0 rounded-xl relative" aria-label="Open Menu">
                  <Menu className="h-6 w-6" />
                  {(unreadCount > 0 || tradeCount > 0) && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[350px] p-0 flex flex-col border-l border-border bg-background">
                <SheetHeader className="p-6 border-b border-border text-left bg-muted/30 shrink-0">
                  <SheetTitle asChild>
                    <SheetClose asChild>
                      <Link
                        to="/"
                        aria-label="CardPop — back to home"
                        className="text-2xl inline-block"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (location.pathname === '/') {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                      >
                        <CardPopLogo variant="full" iconClassName="w-7 h-[34px]" />
                      </Link>
                    </SheetClose>
                  </SheetTitle>
                </SheetHeader>

                {/* Radix unmounts SheetContent (and this body) when the sheet is
                    closed, so the menu chunk only loads once the user opens it. */}
                <Suspense fallback={
                  <div className="flex-1 flex items-center justify-center" aria-hidden="true">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  </div>
                }>
                  <MobileNavMenus
                    openKey={String(mobileMenuOpen)}
                    onNavigate={() => setMobileMenuOpen(false)}
                    onSearch={handleGlobalSearch}
                    isAdmin={isAdmin}
                    isAuthenticated={isAuthenticated}
                    currentUser={currentUser}
                    isVerified={isVerified}
                    tradeCount={tradeCount}
                    isDark={isDark}
                    toggleDarkMode={toggleDarkMode}
                    onLogout={handleMobileLogout}
                  />
                </Suspense>
              </SheetContent>
            </Sheet>

          </div>

        {/* ── Mobile/tablet search row ──
            The Row-1 search is centred and desktop-only (hidden lg:flex), so
            below lg the only way to search was to open the hamburger. Search is
            the primary discovery path for a marketplace, so surface it inline
            here on every screen under lg. */}
        <div className="lg:hidden py-2.5 border-b border-border/40">
          <SearchBar onSearchChange={handleGlobalSearch} placeholder="Search cards, sets, sellers..." className="max-w-full" />
        </div>

        {/* ── Row 2: Nav links (desktop only) ── */}
        {isDesktop && (
          <div className="hidden lg:flex items-center py-1.5">
            <nav className="flex items-center justify-evenly w-full">
              <Suspense fallback={<div className="h-9 w-full" aria-hidden="true" />}>
                <DesktopNavMenus onNavigate={() => setMobileMenuOpen(false)} />
              </Suspense>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
