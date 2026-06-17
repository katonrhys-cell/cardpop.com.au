
import React, { useState, useEffect, useRef, startTransition } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Menu, Shield, MessageSquare, ArrowRightLeft,
  LayoutDashboard, Package, Users, Calendar, FileText, Building2, Layers, CheckCircle,
  Sun, Moon, ChevronDown, ArrowRight, Layers2, User, LogOut, Settings,
  FolderTree, ListOrdered, BarChart3, Store,
  BookOpen, Globe, Star, Award, TrendingUp, Newspaper, BadgeCheck, Ticket, Handshake,
  Calculator, MapPin, ClipboardList, HelpCircle
} from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import CardPopLogo from '@/components/CardPopLogo.jsx';
import { TCG_CATEGORY_DATA, SPORTS_CATEGORY_DATA } from '@/components/CategoryIcons.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import VaultDropdown from '@/components/VaultDropdown.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import NotificationBell from '@/components/NotificationBell.jsx';

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

const BLOG_CATEGORIES = [
  { slug: 'australia-focus',  label: 'Australia Focus',   desc: 'Local TCG market and events',         Icon: Globe,     gradient: 'from-green-500 to-emerald-600' },
  { slug: 'beginner-guides',  label: 'Beginner Guides',   desc: 'Guides for new collectors',           Icon: BookOpen,  gradient: 'from-blue-500 to-indigo-600'   },
  { slug: 'card-spotlight',   label: 'Card Spotlight',    desc: 'Deep dives into iconic cards',         Icon: Star,      gradient: 'from-yellow-500 to-orange-500' },
  { slug: 'grading-guides',   label: 'Grading Hub',       desc: 'Grading standards and preparation',   Icon: Award,     gradient: 'from-purple-500 to-violet-600' },
  { slug: 'investing-value',  label: 'Investing & Value', desc: 'Investment strategies and valuation', Icon: TrendingUp, gradient: 'from-rose-500 to-pink-600'    },
  { slug: 'news-releases',    label: 'News & Releases',   desc: 'Latest TCG releases and industry news', Icon: Newspaper, gradient: 'from-cyan-500 to-sky-600'  },
];

const NAV_LINKS = [
  { label: 'Shop', href: '/shop' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Blog', href: '/blog' },
  { label: 'Community', href: '/community' },
  { label: 'Events', href: '/events' },
  { label: 'Grading', href: '/grading' },
  { label: 'About', href: '/about' },
];

const ADMIN_LINKS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Verification', href: '/admin/verification', icon: CheckCircle },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Orders', href: '/admin/orders', icon: ListOrdered },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree },
  { label: 'Brands', href: '/admin/brands', icon: Building2 },
  { label: 'Product Lines', href: '/admin/product-lines', icon: Layers },
  { label: 'Marketplace', href: '/admin/marketplace', icon: Store },
  { label: 'Events', href: '/admin/events', icon: Calendar },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
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
  const navigate = useNavigate();

  const handleCollectionNav = (slug) => {
    startTransition(() => {
      navigate(`/collections/${slug}`);
      onNavigate?.();
    });
  };

  return (
    <div className="mb-6">
      <p className="px-1 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">
        Browse Collections
      </p>

      {/* TCG accordion */}
      <button
        onClick={() => startTransition(() => setTcgOpen(o => !o))}
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
            <SheetClose key={cat.name} asChild>
              <button
                onClick={() => handleCollectionNav(cat.slug)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${cat.gradient} shrink-0`}>
                  <cat.Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground truncate">{cat.name}</span>
              </button>
            </SheetClose>
          ))}
        </div>
      )}

      {/* Sports accordion */}
      <button
        onClick={() => startTransition(() => setSportsOpen(o => !o))}
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
            <SheetClose key={cat.name} asChild>
              <button
                onClick={() => handleCollectionNav(cat.slug)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${cat.gradient} shrink-0`}>
                  <cat.Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground truncate">{cat.name}</span>
              </button>
            </SheetClose>
          ))}
        </div>
      )}
    </div>
  );
};

// Shared open/close behaviour for the desktop hover dropdowns.
// Hover-open must ignore non-mouse pointers: on touch screens a tap fires a
// synthetic mouseenter immediately followed by click, so a plain
// onMouseEnter+toggle pair opens the menu and instantly closes it again
// (and the next tap does the opposite), making the menus feel dead.
const useHoverDropdown = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timerRef = useRef(null);
  const openedByHover = useRef(false);
  const location = useLocation();

  const handlePointerEnter = (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timerRef.current);
    if (!open) openedByHover.current = true;
    setOpen(true);
  };
  const handlePointerLeave = (e) => {
    if (e.pointerType !== 'mouse') return;
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };
  const handleTriggerClick = () => {
    // A click right after hover-open (mouse users clicking the trigger they
    // just hovered) should keep the menu open, not toggle it shut.
    if (open && openedByHover.current) {
      openedByHover.current = false;
      return;
    }
    openedByHover.current = false;
    startTransition(() => setOpen(o => !o));
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close when the route changes (e.g. navigation from within the panel)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick };
};

// ─── Browse Collections mega-dropdown ─────────────────────────────────────────
const BrowseDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();

  return (
    <div
      className="relative"
      ref={ref}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Trigger */}
      <button
        onClick={handleTriggerClick}
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

// ─── Blog mega-dropdown ───────────────────────────────────────────────────────
const BlogDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isBlogActive = location.pathname.startsWith('/blog');

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isBlogActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Blog
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <Link
            to="/blog"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div>
              <span className="text-sm font-bold text-foreground">The Parallel Report</span>
              <p className="text-xs text-muted-foreground mt-0.5">All articles and stories</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
          <div className="p-3 grid gap-0.5">
            {BLOG_CATEGORIES.map(cat => (
              <Link
                key={cat.slug}
                to={`/blog/category/${cat.slug}`}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${cat.gradient} shrink-0 shadow-sm`}>
                  <cat.Icon className="w-4 h-4 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const COMMUNITY_ITEMS = [
  { href: '/community/forum',          label: 'Forum',                 desc: 'Discussions and community posts',        Icon: MessageSquare, gradient: 'from-violet-500 to-purple-600'  },
  { href: '/community/profiles',       label: 'Profiles',              desc: 'Browse collector profiles',              Icon: Users,         gradient: 'from-sky-500 to-blue-600'      },
  { href: '/community/local-traders',  label: 'Local Traders',         desc: 'Endorsed sellers near you',              Icon: BadgeCheck,    gradient: 'from-emerald-500 to-teal-600'  },
  { href: '/community/retailers',      label: 'Retailers & Suppliers', desc: 'Find local shops and suppliers',         Icon: Store,         gradient: 'from-amber-500 to-orange-500'  },
  { href: '/community/map',            label: 'Community Map',         desc: 'Stores, shows & traders near you',       Icon: MapPin,        gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/community/whatnot',        label: 'Whatnot',               desc: 'Live buying and selling shows',          Icon: WhatnotIcon,   gradient: 'from-green-500 to-emerald-600', isWhatnot: true },
];

// ─── Community mega-dropdown ──────────────────────────────────────────────────
const CommunityDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isCommunityActive = location.pathname.startsWith('/community');

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isCommunityActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Community
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <Link
            to="/community"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div>
              <span className="text-sm font-bold text-foreground">Community Hub</span>
              <p className="text-xs text-muted-foreground mt-0.5">Connect with collectors</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
          <div className="p-3 grid gap-0.5">
            {COMMUNITY_ITEMS.map(item => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${item.isWhatnot ? '' : item.gradient} shrink-0 shadow-sm overflow-hidden`}>
                  <item.Icon className="w-4 h-4 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EVENT_ITEMS = [
  { href: '/events/card-shows',       label: 'Card Shows',       desc: 'Trading card fairs and expos',        Icon: Ticket,    gradient: 'from-red-500 to-rose-600'      },
  { href: '/events/trade-events',     label: 'Trade Events',     desc: 'Swap meets and trading nights',       Icon: Handshake, gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/events/community-events', label: 'Community Events', desc: 'Collector meetups and community fun', Icon: Users,     gradient: 'from-violet-500 to-purple-600' },
  { href: '/events/store-events',     label: 'Store Events',     desc: 'Local game store tournaments',        Icon: Store,     gradient: 'from-amber-500 to-orange-500'  },
];

// ─── Events dropdown ──────────────────────────────────────────────────────────
const EventsDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isEventsActive = location.pathname.startsWith('/events');

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isEventsActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Events
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <Link
            to="/events"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div>
              <span className="text-sm font-bold text-foreground">All Events</span>
              <p className="text-xs text-muted-foreground mt-0.5">Full Australian event calendar</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
          <div className="p-3 grid gap-0.5">
            {EVENT_ITEMS.map(item => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${item.gradient} shrink-0 shadow-sm`}>
                  <item.Icon className="w-4 h-4 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const GRADING_ITEMS = [
  { href: '/grading/estimator',          label: 'CardPop Grade Estimator',  desc: 'Estimate your card grade instantly',      Icon: Calculator,    gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/grading/roi-calculator',     label: 'Grading ROI Calculator',   desc: 'Is grading worth it? Calculate your ROI', Icon: TrendingUp,    gradient: 'from-emerald-500 to-green-600' },
  { href: '/grading/grade-scale',        label: 'Grade Scale',              desc: 'Understand grading scales and standards', Icon: ClipboardList, gradient: 'from-violet-500 to-purple-600' },
  { href: '/grading/local-graders',      label: 'Local Graders',            desc: 'Find graders near you in Australia',      Icon: MapPin,        gradient: 'from-sky-500 to-blue-600'     },
  { href: '/grading/submission-partners',label: 'Submission Partners',      desc: 'Trusted submission services and agents',  Icon: Handshake,     gradient: 'from-amber-500 to-orange-500' },
  { href: '/grading/where-to-grade',     label: 'Where to Grade My Cards',  desc: 'Compare grading companies and options',   Icon: HelpCircle,    gradient: 'from-rose-500 to-pink-600'    },
];

// ─── Grading dropdown ─────────────────────────────────────────────────────────
const GradingDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isGradingActive = location.pathname.startsWith('/grading');

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isGradingActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Grading
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <Link
            to="/grading"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div>
              <span className="text-sm font-bold text-foreground">Grading Hub</span>
              <p className="text-xs text-muted-foreground mt-0.5">Everything about card grading</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
          <div className="p-3 grid gap-0.5">
            {GRADING_ITEMS.map(item => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${item.gradient} shrink-0 shadow-sm`}>
                  <item.Icon className="w-4 h-4 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Mobile blog section (expandable) ────────────────────────────────────────
const MobileBlogSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          The Parallel Report
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          <SheetClose asChild>
            <Link
              to="/blog"
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            >
              All Articles
            </Link>
          </SheetClose>
          {BLOG_CATEGORIES.map(cat => (
            <SheetClose key={cat.slug} asChild>
              <Link
                to={`/blog/category/${cat.slug}`}
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${cat.gradient} shrink-0`}>
                  <cat.Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-xs font-semibold text-foreground truncate">{cat.label}</span>
              </Link>
            </SheetClose>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Mobile events section (expandable) ──────────────────────────────────────
const MobileEventsSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Events
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          <SheetClose asChild>
            <Link
              to="/events"
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            >
              All Events
            </Link>
          </SheetClose>
          {EVENT_ITEMS.map(item => (
            <SheetClose key={item.href} asChild>
              <Link
                to={item.href}
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${item.gradient} shrink-0`}>
                  <item.Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
              </Link>
            </SheetClose>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Mobile community section (expandable) ───────────────────────────────────
const MobileCommunitySection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Community
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          <SheetClose asChild>
            <Link
              to="/community"
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            >
              Community Hub
            </Link>
          </SheetClose>
          {COMMUNITY_ITEMS.map(item => (
            <SheetClose key={item.label} asChild>
              <Link
                to={item.href}
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${item.isWhatnot ? '' : item.gradient} shrink-0 overflow-hidden`}>
                  <item.Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
              </Link>
            </SheetClose>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Mobile grading section (expandable) ─────────────────────────────────────
const MobileGradingSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          Grading
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          <SheetClose asChild>
            <Link
              to="/grading"
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            >
              Grading Hub
            </Link>
          </SheetClose>
          {GRADING_ITEMS.map(item => (
            <SheetClose key={item.href} asChild>
              <Link
                to={item.href}
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${item.gradient} shrink-0`}>
                  <item.Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
              </Link>
            </SheetClose>
          ))}
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
            <img src={currentUser.avatar_url} alt={currentUser.name} className="h-full w-full object-cover" width="32" height="32" />
          ) : (
            <User className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex flex-col items-start overflow-hidden flex-1">
          <span className="text-sm font-bold truncate w-full text-left">{currentUser.display_name || currentUser.name || 'Collector'}</span>
          <span className="text-xs text-muted-foreground truncate w-full text-left">View Profile Options</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5 pl-2">
          <SheetClose asChild>
            <Link to="/account" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link to="/my-vault" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <Package className="w-4 h-4" /> My Vault
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link to="/trade-requests" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <ArrowRightLeft className="w-4 h-4" /> Trade Requests
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link to="/account/events" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <Calendar className="w-4 h-4" /> My Events
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link to="/account/profile" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <Settings className="w-4 h-4" /> Account Settings
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-destructive/10 text-destructive transition-colors text-sm font-medium w-full text-left">
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </SheetClose>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const { isAuthenticated, currentUser, isAdmin, logout, isVerified, loading: authLoading } = useAuth();
  const { cartItems, setIsCartOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
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

    // Watch for any style change on body and fix it after animations settle
    const observer = new MutationObserver(() => {
      setTimeout(clearStaleBodyStyles, 350);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });

    // Periodic sweep as a last resort (500ms is imperceptible to users)
    const interval = setInterval(clearStaleBodyStyles, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
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

            {!authLoading && isAuthenticated && (
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

            {!authLoading && isAuthenticated && (
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

            {!authLoading && isAuthenticated && (
              <div className="hidden sm:block">
                <NotificationBell />
              </div>
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
              {authLoading ? (
                optimisticAuth ? (
                  // Matches the VaultDropdown's h-10 w-10 circular avatar button
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" aria-hidden="true" />
                ) : (
                  // Matches Login (xl only) + Join Vault button exact widths
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <div className="h-9 w-[57px] rounded-xl bg-muted animate-pulse hidden xl:block" />
                    <div className="h-9 w-[84px] rounded-xl bg-muted animate-pulse" />
                  </div>
                )
              ) : isAuthenticated ? (
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

                  {/* Mobile Blog categories */}
                  <MobileBlogSection
                    key={`blog-${String(mobileMenuOpen)}`}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />

                  {/* Mobile Community */}
                  <MobileCommunitySection
                    key={`community-${String(mobileMenuOpen)}`}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />

                  {/* Mobile Events */}
                  <MobileEventsSection
                    key={`events-${String(mobileMenuOpen)}`}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />

                  {/* Mobile Grading */}
                  <MobileGradingSection
                    key={`grading-${String(mobileMenuOpen)}`}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />

                  <nav className="flex flex-col gap-1.5 mb-6">
                    {NAV_LINKS.filter(l => l.label !== 'Blog' && l.label !== 'Community' && l.label !== 'Events' && l.label !== 'Grading').map((link) => {
                      const isActive = isNavLinkActive(link);
                      return (
                        <SheetClose key={link.label} asChild>
                          <Link
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
                        </SheetClose>
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
                          <SheetClose key={link.label} asChild>
                            <Link
                              to={link.href}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-[hsl(var(--admin-warning,24.6_95%_53.1%))] hover:bg-[hsl(var(--admin-warning,24.6_95%_53.1%))]/10 transition-colors"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <link.icon className="w-4 h-4" />
                              {link.label}
                            </Link>
                          </SheetClose>
                        ))}
                      </nav>
                    </div>
                  )}

                  {isAuthenticated && (
                    <div className="grid grid-cols-2 gap-3 mb-8">
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold">
                          <Link to="/verify-account" className="flex items-center gap-2 text-xs px-1">
                            <CheckCircle className="w-4 h-4" />
                            Verify
                          </Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold">
                          <Link to="/trade-requests" className="flex items-center gap-2 text-xs px-1">
                            <ArrowRightLeft className="w-4 h-4" />
                            Trades
                            {tradeCount > 0 && <Badge className="ml-1 bg-accent text-accent-foreground px-1">{tradeCount}</Badge>}
                          </Link>
                        </Button>
                      </SheetClose>
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
                      <SheetClose asChild>
                        <Button asChild variant="default" className="w-full rounded-xl h-12 font-bold tracking-wide text-base shadow-sm">
                          <Link to="/signup">Join Vault</Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button asChild variant="outline" className="w-full rounded-xl h-12 font-bold text-base">
                          <Link to="/login">Sign In</Link>
                        </Button>
                      </SheetClose>
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
              if (link.label === 'Blog') {
                return <BlogDropdown key="blog" onNavigate={() => setMobileMenuOpen(false)} />;
              }
              if (link.label === 'Community') {
                return <CommunityDropdown key="community" onNavigate={() => setMobileMenuOpen(false)} />;
              }
              if (link.label === 'Events') {
                return <EventsDropdown key="events" onNavigate={() => setMobileMenuOpen(false)} />;
              }
              if (link.label === 'Grading') {
                return <GradingDropdown key="grading" onNavigate={() => setMobileMenuOpen(false)} />;
              }
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
