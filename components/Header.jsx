
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Menu, Shield, MessageSquare, ArrowRightLeft,
  LayoutDashboard, Package, Users, Calendar, FileText, Building2, Layers, CheckCircle,
  Sun, Moon, ChevronDown, ArrowRight, Layers2, User, LogOut, Settings
} from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import { TCG_CATEGORY_DATA, SPORTS_CATEGORY_DATA } from '@/components/CategoryIcons.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import VaultDropdown from '@/components/VaultDropdown.jsx';
import SearchBar from '@/components/SearchBar.jsx';

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

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Blog', href: '/blog' },
  { label: 'Community', href: '/community' },
  { label: 'Events', href: '/community/events' },
  { label: 'Grading', href: '/grading' },
  { label: 'About', href: '/about' },
];

const ADMIN_LINKS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Verification', href: '/admin/verification', icon: CheckCircle },
  { label: 'Brands', href: '/admin/brands', icon: Building2 },
  { label: 'Product Lines', href: '/admin/product-lines', icon: Layers },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Events', href: '/admin/events', icon: Calendar },
  { label: 'Content', href: '/admin/content', icon: FileText },
];

// ─── Category badge used inside the dropdown ──────────────────────────────────
const CategoryBadge = ({ gradient, Icon }) => (
  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} shrink-0 shadow-sm`}>
    <Icon className="w-4 h-4" />
  </span>
);

// ─── Mobile browse section (expandable) ──────────────────────────────────────
const MobileBrowseSection = ({ onNavigate }) => {
  const [tcgOpen, setTcgOpen] = useState(false);
  const [sportsOpen, setSportsOpen] = useState(false);

  return (
    <div className="mb-6">
      <p className="px-1 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">
        Browse Collections
      </p>

      {/* TCG accordion */}
      <button
        onClick={() => setTcgOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers2 className="w-4 h-4 text-primary" />
          Trading Card Games
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${tcgOpen ? 'rotate-180' : ''}`} />
      </button>
      {tcgOpen && (
        <div className="grid grid-cols-2 gap-0.5 mb-1 pl-2">
          {TCG_CATEGORY_DATA.map(cat => (
            <Link
              key={cat.name}
              to={`/collections/${cat.slug}`}
              onClick={onNavigate}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${cat.gradient} shrink-0`}>
                <cat.Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold text-foreground truncate">{cat.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Sports accordion */}
      <button
        onClick={() => setSportsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers2 className="w-4 h-4 text-primary" />
          Sporting Cards
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${sportsOpen ? 'rotate-180' : ''}`} />
      </button>
      {sportsOpen && (
        <div className="grid grid-cols-2 gap-0.5 mb-1 pl-2">
          {SPORTS_CATEGORY_DATA.map(cat => (
            <Link
              key={cat.name}
              to={`/collections/${cat.slug}`}
              onClick={onNavigate}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${cat.gradient} shrink-0`}>
                <cat.Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold text-foreground truncate">{cat.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Browse Collections mega-dropdown ─────────────────────────────────────────
const BrowseDropdown = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Browse Collections
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-[580px] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* View all row */}
          <Link
            to="/marketplace"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <span className="text-sm font-bold text-foreground">View All Listings</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Two columns */}
          <div className="grid grid-cols-2 divide-x divide-border">
            {/* Trading Card Games */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Layers2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  Trading Card Games
                </span>
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {TCG_CATEGORY_DATA.map(cat => (
                  <Link
                    key={cat.name}
                    to={`/collections/${cat.slug}`}
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-muted transition-colors group"
                  >
                    <CategoryBadge gradient={cat.gradient} Icon={cat.Icon} />
                    <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Sporting Cards */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Layers2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  Sporting Cards
                </span>
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {SPORTS_CATEGORY_DATA.map(cat => (
                  <Link
                    key={cat.name}
                    to={`/collections/${cat.slug}`}
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-muted transition-colors group"
                  >
                    <CategoryBadge gradient={cat.gradient} Icon={cat.Icon} />
                    <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Plain inline account section — no nested Radix portals inside the Sheet Dialog
const MobileAccountSection = ({ currentUser, isVerified, onNavigate, onLogout }) => {
  const [expanded, setExpanded] = useState(false);
  if (!currentUser) return null;
  return (
    <div className="w-full">
      <button
        className="w-full flex items-center gap-3 h-14 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/50 transition-colors"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
          {currentUser.avatar_url ? (
            <img src={currentUser.avatar_url} alt={currentUser.name} className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex flex-col items-start overflow-hidden flex-1">
          <span className="text-sm font-bold truncate w-full text-left">{currentUser.name || 'Collector'}</span>
          <span className="text-xs text-muted-foreground truncate w-full text-left">View Profile Options</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5 pl-2">
          <Link to="/account" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link to="/my-vault" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
            <Package className="w-4 h-4" /> My Vault
          </Link>
          <Link to="/trade-requests" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
            <ArrowRightLeft className="w-4 h-4" /> Trade Requests
          </Link>
          <Link to="/account/profile" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
            <Settings className="w-4 h-4" /> Account Settings
          </Link>
          <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-destructive/10 text-destructive transition-colors text-sm font-medium w-full text-left">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const { isAuthenticated, currentUser, isAdmin, logout, isVerified } = useAuth();
  const { cartItems, setIsCartOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);
  const { isDark, toggle: toggleDarkMode } = useDarkMode();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const [{ count: msgCount }, { count: tradeCount }] = await Promise.all([
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', currentUser.id)
            .eq('is_read', false),
          supabase
            .from('trades')
            .select('*', { count: 'exact', head: true })
            .eq('responder_id', currentUser.id)
            .eq('status', 'pending')
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

    const msgChannel = supabase
      .channel('header-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchData())
      .subscribe();
    const tradeChannel = supabase
      .channel('header-trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => fetchData())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(tradeChannel);
    };
  }, [isAuthenticated, currentUser]);

  const cartItemCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const handleGlobalSearch = (query) => {
    if (query.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(query)}`);
      setMobileMenuOpen(false);
    }
  };

  const handleMobileLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const isNavLinkActive = (link) => {
    const pathname = location.pathname;
    if (pathname === link.href) return true;
    if (link.href === '/') return false;
    if (pathname.startsWith(link.href + '/')) {
      const hasMoreSpecificMatch = NAV_LINKS.some(otherLink =>
        otherLink.href !== link.href &&
        otherLink.href.startsWith(link.href + '/') &&
        (pathname === otherLink.href || pathname.startsWith(otherLink.href + '/'))
      );
      return !hasMoreSpecificMatch;
    }
    return false;
  };

  return (
    <header 
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-background/90 backdrop-blur-md shadow-sm border-b border-border' 
          : 'bg-background border-b border-border/50'
      }`}
    >
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Row 1: Logo + Search + actions ── */}
        <div className="relative flex items-center py-3 border-b border-border/40">

          <Link to="/" className="shrink-0 relative z-10" onClick={() => setMobileMenuOpen(false)}>
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

            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="hidden xl:flex gap-2 text-[hsl(var(--admin-warning,24.6_95%_53.1%))] hover:text-[hsl(var(--admin-warning,24.6_95%_53.1%))] hover:bg-[hsl(var(--admin-warning,24.6_95%_53.1%))]/10 rounded-xl">
                <Link to="/admin">
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              </Button>
            )}

            {isAuthenticated && (
              <Button asChild variant="ghost" size="icon" className="hidden sm:flex relative rounded-xl hover:bg-muted">
                <Link to="/trade-requests">
                  <ArrowRightLeft className="h-5 w-5" />
                  {tradeCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-accent text-accent-foreground border-none font-bold tabular-nums shadow-sm">
                      {tradeCount > 99 ? '99+' : tradeCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}

            {isAuthenticated && (
              <Button asChild variant="ghost" size="icon" className="hidden sm:flex relative rounded-xl hover:bg-muted">
                <Link to="/messaging">
                  <MessageSquare className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-none font-bold tabular-nums shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}

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
              {isAuthenticated ? (
                <VaultDropdown isMobile={false} />
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="font-bold hidden xl:inline-flex rounded-xl">
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button asChild size="sm" className="font-bold rounded-xl shadow-sm tracking-wide">
                    <Link to="/signup">Join Vault</Link>
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
                    <span className="text-2xl">
                      <CardPopLogo variant="full" iconClassName="w-7 h-[34px]" />
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-6 px-4">
                  {/* Mobile search */}
                  <div className="mb-5">
                    <SearchBar
                      onSearchChange={handleGlobalSearch}
                      placeholder="Search cards, sets, sellers..."
                      className="max-w-full"
                    />
                  </div>

                  {/* Mobile Browse Collections — key resets accordion state each time menu opens */}
                  <MobileBrowseSection
                    key={String(mobileMenuOpen)}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />

                  <nav className="flex flex-col gap-1.5 mb-6">
                    {NAV_LINKS.map((link) => {
                      const isActive = isNavLinkActive(link);
                      return (
                        <Link
                          key={link.label}
                          to={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`px-4 py-3.5 rounded-xl text-base font-bold transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>

                  {isAdmin && (
                    <div className="mb-8">
                      <h4 className="px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" />
                        Admin Portal
                      </h4>
                      <nav className="flex flex-col gap-1">
                        {ADMIN_LINKS.map((link) => (
                          <Link
                            key={link.label}
                            to={link.href}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-[hsl(var(--admin-warning,24.6_95%_53.1%))] hover:bg-[hsl(var(--admin-warning,24.6_95%_53.1%))]/10 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <link.icon className="w-4 h-4" />
                            {link.label}
                          </Link>
                        ))}
                      </nav>
                    </div>
                  )}

                  {isAuthenticated && (
                    <div className="grid grid-cols-2 gap-3 mb-8">
                      <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold" onClick={() => setMobileMenuOpen(false)}>
                        <Link to="/verify-account" className="flex items-center gap-2 text-xs px-1">
                          <CheckCircle className="w-4 h-4" />
                          Verify
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold" onClick={() => setMobileMenuOpen(false)}>
                        <Link to="/trade-requests" className="flex items-center gap-2 text-xs px-1">
                          <ArrowRightLeft className="w-4 h-4" />
                          Trades
                          {tradeCount > 0 && <Badge className="ml-1 bg-accent text-accent-foreground px-1">{tradeCount}</Badge>}
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-border bg-card shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)] shrink-0 flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-12 font-bold text-base flex items-center gap-2"
                    onClick={toggleDarkMode}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </Button>
                  {isAuthenticated ? (
                    <MobileAccountSection
                      currentUser={currentUser}
                      isVerified={isVerified}
                      onNavigate={() => setMobileMenuOpen(false)}
                      onLogout={handleMobileLogout}
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Button asChild variant="default" className="w-full rounded-xl h-12 font-bold tracking-wide text-base shadow-sm">
                        <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>Join Vault</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full rounded-xl h-12 font-bold text-base">
                        <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

          </div>
        </div>

        {/* ── Row 2: Nav links (desktop only) ── */}
        <div className="hidden lg:flex items-center py-1.5">
          <nav className="flex items-center justify-evenly w-full">
            <BrowseDropdown onNavigate={() => setMobileMenuOpen(false)} />
            {NAV_LINKS.map((link) => {
              const isActive = isNavLinkActive(link);
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
    </header>
  );
};

export default Header;
