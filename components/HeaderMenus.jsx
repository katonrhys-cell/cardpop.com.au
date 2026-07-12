// Desktop mega-dropdowns + mobile Sheet menu body, split out of Header.jsx so
// they load as their own async chunk instead of parsing on first paint. On the
// homepage (especially mobile, where Row-2 nav is never shown and the menu sits
// behind the hamburger) this keeps CategoryIcons and ~35 lucide icons off the
// critical path — the single biggest slice of the Header's initial JS.
//
// The code here is a verbatim move from Header.jsx; only the two exported entry
// components (DesktopNavMenus / MobileNavMenus) and the isNavLinkActive helper
// were added to expose the pieces Header now renders through <Suspense>.
import React, { useState, useEffect, useRef, startTransition } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft, LayoutDashboard, Package, Users, Calendar, FileText, Building2,
  Layers, CheckCircle, Sun, Moon, ChevronDown, ChevronLeft, ChevronRight, ArrowRight, Layers2, User, LogOut,
  Settings, FolderTree, ListOrdered, BarChart3, Store, Shield,
  BookOpen, Globe, Star, Award, TrendingUp, Newspaper, BadgeCheck, Ticket, Handshake,
  Calculator, MapPin, ClipboardList, HelpCircle, MessageSquare,
  ShoppingBag, LineChart, Info,
} from 'lucide-react';
import { TCG_CATEGORY_DATA, SPORTS_CATEGORY_DATA } from '@/components/CategoryIcons.jsx';
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SheetClose } from '@/components/ui/sheet';
import SearchBar from '@/components/SearchBar.jsx';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';

export const NAV_LINKS = [
  // `icon` (where present) matches the lucide icon in that page's own hero/heading,
  // so the mobile menu's flat links carry the same visual cue as the page they open.
  { label: 'Shop', href: '/shop', icon: ShoppingBag },
  { label: 'Marketplace', href: '/marketplace', icon: Users },
  { label: 'Analytics', href: '/analytics', icon: LineChart },
  { label: 'Blog', href: '/blog' },
  { label: 'Community', href: '/community' },
  { label: 'Events', href: '/events' },
  { label: 'Grading', href: '/grading' },
  { label: 'About', href: '/about', icon: Info },
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

const BLOG_CATEGORIES = [
  { slug: 'australia-focus',  label: 'Australia Focus',   desc: 'Local TCG market and events',         Icon: Globe,     gradient: 'from-green-500 to-emerald-600' },
  { slug: 'beginner-guides',  label: 'Beginner Guides',   desc: 'Guides for new collectors',           Icon: BookOpen,  gradient: 'from-blue-500 to-indigo-600'   },
  { slug: 'card-spotlight',   label: 'Card Spotlight',    desc: 'Deep dives into iconic cards',         Icon: Star,      gradient: 'from-yellow-500 to-orange-500' },
  { slug: 'grading-guides',   label: 'Grading Hub',       desc: 'Grading standards and preparation',   Icon: Award,     gradient: 'from-purple-500 to-violet-600' },
  { slug: 'investing-value',  label: 'Investing & Value', desc: 'Investment strategies and valuation', Icon: TrendingUp, gradient: 'from-rose-500 to-pink-600'    },
  { slug: 'news-releases',    label: 'News & Releases',   desc: 'Latest TCG releases and industry news', Icon: Newspaper, gradient: 'from-cyan-500 to-sky-600'  },
];

const COMMUNITY_ITEMS = [
  { href: '/community/forum',          label: 'Forum',                 desc: 'Discussions and community posts',        Icon: MessageSquare, gradient: 'from-violet-500 to-purple-600'  },
  { href: '/community/profiles',       label: 'Profiles',              desc: 'Browse collector profiles',              Icon: Users,         gradient: 'from-emerald-500 to-teal-600'   },
  { href: '/community/local-traders',  label: 'Local Traders',         desc: 'Endorsed sellers near you',              Icon: BadgeCheck,    gradient: 'from-blue-500 to-cyan-600'    },
  { href: '/card-shops',               label: 'Card Shop Directory',   desc: 'Find local card shops city by city',     Icon: Store,         gradient: 'from-amber-500 to-orange-500'  },
  { href: '/community/map',            label: 'Community Map',         desc: 'Stores, shows & traders near you',       Icon: MapPin,        gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/community/whatnot',        label: 'Whatnot',               desc: 'Live buying and selling shows',          Icon: WhatnotIcon,   gradient: 'from-green-500 to-emerald-600', isWhatnot: true },
];

const EVENT_ITEMS = [
  { href: '/events/card-shows',       label: 'Card Shows',       desc: 'Trading card fairs and expos',        Icon: Ticket,    gradient: 'from-red-500 to-rose-600'      },
  { href: '/events/trade-events',     label: 'Trade Events',     desc: 'Swap meets and trading nights',       Icon: Handshake, gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/events/community-events', label: 'Community Events', desc: 'Collector meetups and community fun', Icon: Users,     gradient: 'from-violet-500 to-purple-600' },
  { href: '/events/store-events',     label: 'Store Events',     desc: 'Local game store tournaments',        Icon: Store,     gradient: 'from-amber-500 to-orange-500'  },
];

const ANALYTICS_ITEMS = [
  { href: '/analytics', label: 'Market Analytics', desc: 'Live prices, movers and trends',   Icon: LineChart,  gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/prices',    label: 'Card Prices',      desc: 'What cards are worth in AUD',       Icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' },
];

const GRADING_ITEMS = [
  { href: '/grading/estimator',          label: 'CardPop Grade Estimator',  desc: 'Estimate your card grade instantly',      Icon: Calculator,    gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/grading/roi-calculator',     label: 'Grading ROI Calculator',   desc: 'See if grading a card is worth it',       Icon: TrendingUp,    gradient: 'from-green-500 to-emerald-600' },
  { href: '/grading/scales',             label: 'Grade Scale',              desc: 'Understand grading scales and standards', Icon: ClipboardList, gradient: 'from-violet-500 to-purple-600' },
  { href: '/grading/local-graders',      label: 'Local Graders',            desc: 'Find graders near you in Australia',      Icon: MapPin,        gradient: 'from-emerald-500 to-teal-600' },
  { href: '/grading/submission-partners',label: 'Submission Partners',      desc: 'Trusted submission services and agents',  Icon: Handshake,     gradient: 'from-amber-500 to-orange-500' },
  { href: '/grading/companies',          label: 'Where to Grade My Cards',  desc: 'Compare grading companies and options',   Icon: HelpCircle,    gradient: 'from-rose-500 to-pink-600'    },
];

// Active-state test for a plain top-level nav link. Kept module-level (was a
// Header closure) so both the desktop and mobile menus can share it.
export const isNavLinkActive = (link, pathname) => {
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
    <div className="mb-4">
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

// ─── Shop mega-dropdown ───────────────────────────────────────────────────────
// Mirrors the /shop "Shop by Category" browser: a strip of gradient category
// cards you can rotate through (prev/next arrows, like the homepage Browse by
// Category carousel) or hover, with the hovered/selected category's
// subcategories revealed below.
const ShopDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isShopActive = location.pathname === '/shop' || location.pathname.startsWith('/shop/');
  const [activeIdx, setActiveIdx] = useState(0);
  const count = SHOP_CATEGORY_GROUPS.length;
  const activeGroup = SHOP_CATEGORY_GROUPS[activeIdx];
  const rotate = (dir) => setActiveIdx((i) => (i + dir + count) % count);

  // Start each open on the first category.
  useEffect(() => { if (!open) setActiveIdx(0); }, [open]);

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isShopActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Shop
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-[720px] max-w-[calc(100vw-3rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <Link
            to="/shop"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div>
              <span className="text-sm font-bold text-foreground">Shop All Supplies</span>
              <p className="text-xs text-muted-foreground mt-0.5">Sleeves, storage, display, shipping &amp; grading gear</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Category card strip with rotate arrows */}
          <div className="flex items-center gap-2 px-4 pt-4">
            <button
              type="button"
              aria-label="Previous category"
              onClick={() => rotate(-1)}
              className="shrink-0 w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 flex gap-2">
              {SHOP_CATEGORY_GROUPS.map((group, i) => {
                const active = i === activeIdx;
                return (
                  <button
                    key={group.slug}
                    type="button"
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveIdx(i); }}
                    onClick={() => setActiveIdx(i)}
                    onFocus={() => setActiveIdx(i)}
                    aria-pressed={active}
                    aria-label={`${group.label} supplies`}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 h-16 rounded-xl bg-gradient-to-br ${group.gradient} transition-all duration-200 focus:outline-none ${
                      active ? 'ring-2 ring-foreground/30 ring-offset-1 ring-offset-card shadow-md' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <group.Icon className="w-4 h-4 text-white drop-shadow-sm" />
                    <span className="text-[10px] font-bold text-white drop-shadow-sm leading-none">{group.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Next category"
              onClick={() => rotate(1)}
              className="shrink-0 w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Subcategories for the active category */}
          <div className="p-4">
            <div className="flex items-baseline gap-2 mb-2 px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{activeGroup.label}</span>
              <span className="text-[11px] text-muted-foreground/70 truncate">{activeGroup.blurb}</span>
            </div>
            <div className="grid grid-cols-2 gap-0.5">
              {activeGroup.items.map(item => (
                <Link
                  key={item.slug}
                  to={`/shop/category/${item.slug}`}
                  onClick={() => { setOpen(false); onNavigate?.(); }}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted transition-colors group/item"
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${activeGroup.gradient} shrink-0 shadow-sm transition-transform duration-300 group-hover/item:scale-110`}>
                    <item.Icon className="w-3.5 h-3.5 text-white" />
                  </span>
                  <span className="text-[13px] font-medium text-foreground group-hover/item:text-primary transition-colors truncate">
                    {item.name}
                  </span>
                </Link>
              ))}
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
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 shadow-sm overflow-hidden ${item.isWhatnot ? 'bg-black' : (item.label === 'Local Traders' ? '' : `bg-gradient-to-br ${item.gradient}`)}`}
                  style={item.label === 'Local Traders' ? { backgroundImage: `linear-gradient(to bottom right, hsl(var(--verified-badge)), hsl(199 95% 35%))` } : {}}
                >
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

// ─── Analytics dropdown ───────────────────────────────────────────────────────
const AnalyticsDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isAnalyticsActive = location.pathname.startsWith('/analytics') || location.pathname.startsWith('/prices');

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isAnalyticsActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Analytics
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <Link
            to="/analytics"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div>
              <span className="text-sm font-bold text-foreground">Analytics Hub</span>
              <p className="text-xs text-muted-foreground mt-0.5">Track the trading card market</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
          <div className="p-3 grid gap-0.5">
            {ANALYTICS_ITEMS.map(item => (
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

// ─── Mobile shop section (expandable) ────────────────────────────────────────
const MobileShopSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          Shop
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 mb-1 pl-2">
          <SheetClose asChild>
            <Link
              to="/shop"
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            >
              Shop All Supplies
            </Link>
          </SheetClose>
          {SHOP_CATEGORY_GROUPS.map(group => (
            <div key={group.slug}>
              <div className="flex items-center gap-2 px-3 pt-1 pb-1">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br ${group.gradient} shrink-0`}>
                  <group.Icon className="w-3 h-3 text-white" />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{group.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {group.items.map(item => (
                  <SheetClose key={item.slug} asChild>
                    <Link
                      to={`/shop/category/${item.slug}`}
                      onClick={onNavigate}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                    >
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${group.gradient} shrink-0`}>
                        <item.Icon className="w-3.5 h-3.5 text-white" />
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                    </Link>
                  </SheetClose>
                ))}
              </div>
            </div>
          ))}
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
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg shrink-0 overflow-hidden ${item.isWhatnot ? 'bg-black' : `bg-gradient-to-br ${item.gradient}`}`}>
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

// ─── Mobile analytics section (expandable) ───────────────────────────────────
const MobileAnalyticsSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <LineChart className="w-4 h-4 text-primary" />
          Analytics
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          {ANALYTICS_ITEMS.map(item => (
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
            <img src={toCdnUrl(currentUser.avatar_url)} alt={currentUser.name} className="h-full w-full object-cover" width="32" height="32" />
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

// ─── Exported entry points ────────────────────────────────────────────────────

// Row-2 desktop navigation (Browse mega-dropdown + top-level links/dropdowns).
export const DesktopNavMenus = ({ onNavigate }) => {
  const location = useLocation();
  const { settings } = usePlatformSettings();
  return (
    <>
      <BrowseDropdown onNavigate={onNavigate} />
      {NAV_LINKS.map((link) => {
        if (link.label === 'Shop') return <ShopDropdown key="shop" onNavigate={onNavigate} />;
        if (link.label === 'Analytics') return <AnalyticsDropdown key="analytics" onNavigate={onNavigate} />;
        if (link.label === 'Blog') return settings.enable_blog === false ? null : <BlogDropdown key="blog" onNavigate={onNavigate} />;
        if (link.label === 'Community') return <CommunityDropdown key="community" onNavigate={onNavigate} />;
        if (link.label === 'Events') return <EventsDropdown key="events" onNavigate={onNavigate} />;
        if (link.label === 'Grading') return <GradingDropdown key="grading" onNavigate={onNavigate} />;
        if (link.label === 'Marketplace' && settings.enable_marketplace === false) return null;
        const isActive = isNavLinkActive(link, location.pathname);
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
    </>
  );
};

// Full scrollable body + footer of the mobile hamburger Sheet.
export const MobileNavMenus = ({
  openKey,
  onNavigate,
  onSearch,
  isAdmin,
  isAuthenticated,
  currentUser,
  isVerified,
  tradeCount,
  isDark,
  toggleDarkMode,
  onLogout,
}) => {
  const location = useLocation();
  const { settings } = usePlatformSettings();
  return (
    <>
      <div className="flex-1 overflow-y-auto pt-4 pb-6 px-4">
        {/* Mobile search */}
        <div className="mb-4">
          <SearchBar
            onSearchChange={onSearch}
            placeholder="Search cards, sets, sellers..."
            className="max-w-full"
          />
        </div>

        {/* Order mirrors the desktop Row-2 nav top-to-bottom: Browse Collections
            leads, then NAV_LINKS in sequence — expandable sections (Blog,
            Community, Events, Grading) and flat links interleaved so the mobile
            menu reads in the same order as the desktop bar reads left-to-right.
            key={openKey} resets accordion state each time the menu opens. */}
        <nav className="flex flex-col mb-6">
          <MobileBrowseSection key={openKey} onNavigate={onNavigate} />

          {NAV_LINKS.map((link) => {
            if (link.label === 'Shop') return <MobileShopSection key={`shop-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Analytics') return <MobileAnalyticsSection key={`analytics-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Blog') return <MobileBlogSection key={`blog-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Community') return <MobileCommunitySection key={`community-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Events') return <MobileEventsSection key={`events-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Grading') return <MobileGradingSection key={`grading-${openKey}`} onNavigate={onNavigate} />;
            const isActive = isNavLinkActive(link, location.pathname);
            const Icon = link.icon;
            return (
              <SheetClose key={link.label} asChild>
                <Link
                  to={link.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 px-4 py-3 mb-4 rounded-xl text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {Icon && <Icon className={`w-4 h-4 shrink-0 ${isActive ? '' : 'text-primary'}`} />}
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
                    onClick={onNavigate}
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
            onNavigate={onNavigate}
            onLogout={onLogout}
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
    </>
  );
};
