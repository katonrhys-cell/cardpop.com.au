
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Menu, Shield, MessageSquare, ArrowRightLeft,
  LayoutDashboard, Package, Users, Calendar, FileText, Building2, Layers, CheckCircle,
  Sun, Moon
} from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import pb from '@/lib/pocketbaseClient.js';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import VaultDropdown from '@/components/VaultDropdown.jsx';
import SearchBar from '@/components/SearchBar.jsx';

export const TCG_COLLECTIONS = [
  'Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh', 'Digimon', 
  'Riftbound', 'TMNT', 'Final Fantasy', 'Disney Lorcana', 'One Piece'
];

export const SPORTS_COLLECTIONS = [
  'NBA', 'NFL', 'MLB', 'Cricket', 'NRL', 'Formula 1', 
  'Wrestling', 'Golf', 'Soccer', 'AFL', 'Tennis', 'UFC'
];

export const COLLECTIONS_LIST = [...TCG_COLLECTIONS, ...SPORTS_COLLECTIONS].sort();

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Analytics', href: '/markets' },
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

const Header = () => {
  const { isAuthenticated, currentUser, isAdmin } = useAuth();
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
        const [msgRes, tradeRes] = await Promise.all([
          pb.collection('messages').getList(1, 1, { 
            filter: `recipient="${currentUser.id}" && isRead=false`, 
            $autoCancel: false 
          }),
          pb.collection('trade_requests').getList(1, 1, { 
            filter: `recipient_id="${currentUser.id}" && status="pending"`, 
            $autoCancel: false 
          })
        ]);
        if (isMounted) {
          setUnreadCount(msgRes.totalItems);
          setTradeCount(tradeRes.totalItems);
        }
      } catch (err) {
        console.error("Failed to fetch notification counts:", err);
      }
    };
    
    fetchData();
    
    pb.collection('messages').subscribe('*', () => fetchData()).catch(console.error);
    pb.collection('trade_requests').subscribe('*', () => fetchData()).catch(console.error);

    return () => {
      isMounted = false;
      pb.collection('messages').unsubscribe('*').catch(() => {});
      pb.collection('trade_requests').unsubscribe('*').catch(() => {});
    };
  }, [isAuthenticated, currentUser]);

  const cartItemCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const handleGlobalSearch = (query) => {
    if (query.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(query)}`);
      setMobileMenuOpen(false);
    }
  };

  const isNavLinkActive = (link) => {
    const pathname = location.pathname;
    if (pathname === link.href) return true;
    if (link.href !== '/' && pathname.startsWith(link.href + '/')) {
      const hasMoreSpecificMatch = NAV_LINKS.some(otherLink => 
        otherLink.href !== link.href && pathname === otherLink.href
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
        <div className="flex flex-wrap items-center justify-between py-3 md:py-0 md:min-h-20 transition-all duration-300">
          
          <Link to="/" className="shrink-0 flex flex-col mr-2 lg:mr-4 xl:mr-8" onClick={() => setMobileMenuOpen(false)}>
            <span className="block h-[3px] bg-primary rounded-full mb-1.5" />
            <span className="font-heading font-bold text-[22px] leading-none tracking-tight text-foreground">
              Card<span className="text-primary">Pop</span>
            </span>
            <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-muted-foreground mt-1">
              Australia
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 mr-auto shrink-0">
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

          <div className="w-full order-last mt-3 md:mt-0 md:order-none md:flex-1 md:max-w-[160px] xl:max-w-xs md:mx-2 xl:mx-4 shrink-1">
            <SearchBar 
              onSearchChange={handleGlobalSearch} 
              placeholder="Search..." 
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 xl:gap-4 shrink-0">
            
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
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-none font-bold tabular-nums shadow-sm"
                >
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Badge>
              )}
            </Button>

            <div className="hidden md:block shrink-0">
              {isAuthenticated ? (
                <VaultDropdown isMobile={false} />
              ) : (
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="font-bold hidden xl:inline-flex rounded-xl">
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button asChild size="sm" className="font-bold rounded-xl shadow-sm tracking-wide">
                    <Link to="/signup">Join Vault</Link>
                  </Button>
                </div>
              )}
            </div>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden shrink-0 rounded-xl relative" aria-label="Open Menu">
                  <Menu className="h-6 w-6" />
                  {(unreadCount > 0 || tradeCount > 0) && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[350px] p-0 flex flex-col border-l border-border bg-background overflow-hidden">
                <SheetHeader className="p-6 border-b border-border text-left bg-muted/30 shrink-0">
                  <SheetTitle asChild>
                    <div className="inline-flex flex-col">
                      <span className="block h-[3px] bg-primary rounded-full mb-1.5" />
                      <span className="font-heading font-bold text-[22px] leading-none tracking-tight text-foreground">
                        Card<span className="text-primary">Pop</span>
                      </span>
                      <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-muted-foreground mt-1">
                        Australia
                      </span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto py-6 px-4">
                  <nav className="flex flex-col gap-1.5 mb-8">
                    {NAV_LINKS.map((link) => {
                      const isActive = isNavLinkActive(link);
                      return (
                        <Link
                          key={link.label}
                          to={link.href}
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
                      <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold">
                        <Link to="/verify-account" className="flex items-center gap-2 text-xs px-1">
                          <CheckCircle className="w-4 h-4" />
                          Verify
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold">
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
                    <VaultDropdown isMobile={true} />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <Button asChild variant="default" className="w-full rounded-xl h-12 font-bold tracking-wide text-base shadow-sm">
                        <Link to="/signup">Join Vault</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full rounded-xl h-12 font-bold text-base">
                        <Link to="/login">Sign In</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
