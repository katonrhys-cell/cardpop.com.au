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
  Layers, CheckCircle, Sun, Moon, ChevronDown, ChevronRight, ArrowRight, Layers2, LogOut,
  Settings, FolderTree, ListOrdered, BarChart3, Store, Shield,
  BookOpen, Award, TrendingUp, BadgeCheck, Ticket, Handshake,
  Calculator, MapPin, ClipboardList, HelpCircle, MessageSquare,
  ShoppingBag, LineChart, Info, Sparkles, Rocket, Tag, MoreHorizontal, Tv2, ScanLine,
} from 'lucide-react';
import { TCG_CATEGORY_DATA, SPORTS_CATEGORY_DATA } from '@/components/CategoryIcons.jsx';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SheetClose } from '@/components/ui/sheet';
import SearchBar from '@/components/SearchBar.jsx';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';

export const NAV_LINKS = [
  // `icon` (where present) matches the lucide icon in that page's own hero/heading,
  // so the mobile menu's flat links carry the same visual cue as the page they open.
  // Six top-level sections, named for what a shopper is looking for: Buy Cards
  // (the marketplace mega-dropdown, rendered first), Supplies (CardPop's own
  // shop — it was labelled "Shop", which sent card buyers to sleeves and
  // binders), Sell, Prices, Community, Grading. Blog and Events fold into the
  // Community dropdown so the three jobs visitors come for — buy, sell, check
  // prices — aren't buried among content links.
  { label: 'Supplies', href: '/shop', icon: ShoppingBag },
  { label: 'Sell', href: '/vault/add', icon: Tag },
  { label: 'Prices', href: '/analytics', icon: LineChart },
  { label: 'Community', href: '/community' },
  { label: 'Grading', href: '/grading' },
];

// Secondary / informational links, grouped under the "More" dropdown so the
// primary nav stays focused on shopping & discovery. Add future secondary
// items here and they appear in both the desktop dropdown and mobile section.
const MORE_ITEMS = [
  { href: '/card-shops',                       label: 'Card Shop Directory',    desc: 'Find local card shops city by city',   Icon: Store,    gradient: 'from-amber-500 to-orange-500' },
  { href: '/community/building-your-business', label: 'Building Your Business', desc: 'Tools we use to grow a card business', Icon: Rocket,   gradient: 'from-rose-500 to-orange-500'  },
  { href: '/pricing',                          label: 'Pricing',                desc: 'Membership plans & seller fees',       Icon: Sparkles, gradient: 'from-amber-500 to-orange-500' },
  { href: '/about',                            label: 'About',                  desc: 'Our story and mission',                Icon: Info,     gradient: 'from-blue-500 to-indigo-600'  },
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
  { label: 'Whatnot Shows', href: '/admin/whatnot-shows', icon: Tv2 },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

const COMMUNITY_ITEMS = [
  { href: '/community/forum',          label: 'Forum',                 desc: 'Discussions and community posts',        Icon: MessageSquare, gradient: 'from-violet-500 to-purple-600'  },
  { href: '/community/leaderboard',    label: 'Leaderboard',           desc: 'Monthly points for active collectors',   Icon: Award,         gradient: 'from-amber-500 to-orange-500'   },
  { href: '/community/profiles',       label: 'Profiles',              desc: 'Browse collector profiles',              Icon: Users,         gradient: 'from-emerald-500 to-teal-600'   },
  { href: '/community/local-traders',  label: 'Local Traders',         desc: 'Endorsed sellers near you',              Icon: BadgeCheck,    gradient: 'from-blue-500 to-cyan-600'    },
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
  { href: '/scan',                     label: 'Card Scanner',     desc: 'Scan any card for an instant price check', Icon: ScanLine, gradient: 'from-red-500 to-rose-600' },
  { href: '/analytics',                label: 'Market Analytics', desc: 'Live prices, movers and trends',   Icon: LineChart,  gradient: 'from-blue-500 to-indigo-600'   },
  { href: '/prices',                   label: 'Card Prices',      desc: 'What cards are worth in AUD',       Icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' },
  { href: '/analytics/buying-guides',  label: 'Buying Guides',    desc: 'New releases & chase cards',        Icon: Sparkles,   gradient: 'from-amber-500 to-orange-500' },
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
        Buy Cards
      </p>

      <SheetClose asChild>
        <Link
          to="/marketplace"
          onClick={onNavigate}
          className="flex items-center justify-between gap-2 px-4 py-3 mb-1 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors text-sm font-bold text-foreground"
        >
          <span className="flex items-center gap-2"><Store className="w-4 h-4 text-primary" aria-hidden="true" />Browse All Cards</span>
          <ArrowRight className="w-4 h-4 text-primary" aria-hidden="true" />
        </Link>
      </SheetClose>

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
                <span className="text-xs font-semibold text-foreground leading-tight">{cat.name}</span>
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
                <span className="text-xs font-semibold text-foreground leading-tight">{cat.name}</span>
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

// ─── Marketplace mega-dropdown ────────────────────────────────────────────────
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
        Buy Cards
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel. The two sections are deliberately uneven: TCG names run long
          ("Magic: The Gathering", "Disney Lorcana") while every sport is an
          acronym or a single word, so the games column gets the extra width
          instead of ellipsising the names. */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-[700px] max-w-[calc(100vw-3rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* View all row */}
          <Link
            to="/marketplace"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <span className="text-sm font-bold text-foreground">Browse All Cards</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Two columns */}
          <div className="grid grid-cols-[1.5fr_1fr] divide-x divide-border">
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
                    <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
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
                    <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
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
// Two-level flyout: the five parent categories (Protection, Storage, …) list
// down the left with their icon badges; hovering (or focusing) one reveals its
// subcategories in the panel to the right. Leaf items carry the same coloured
// icon badge used across the other menus.
//
// Every entry — parents on the left, subcategories on the right — shows a short
// narrative under its label, matching the Prices / Community / Grading menus.
// The subcategory panel is a single column for that reason: two columns of
// label+desc would squeeze both onto an ellipsis.
const ShopDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isShopActive = location.pathname === '/shop' || location.pathname.startsWith('/shop/');
  // No category is active until the user hovers (or focuses) one — the menu
  // opens as just the category list and the subcategory panel expands out on
  // first hover.
  const [activeSlug, setActiveSlug] = useState(null);

  // Collapse back to the bare category list each time the menu closes, so the
  // flyout is predictable rather than stuck on whatever the user last hovered.
  useEffect(() => { if (!open) setActiveSlug(null); }, [open]);

  const { groups: shopGroups } = useShopCategoryGroups();
  const activeGroup = shopGroups.find(g => g.slug === activeSlug) || null;

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
        Supplies
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-2 max-w-[calc(100vw-3rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden transition-[width] duration-300 ease-out ${activeGroup ? 'w-[664px]' : 'w-[292px]'}`}>
          <Link
            to="/shop"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/60 transition-colors group"
          >
            <div className="min-w-0">
              <span className="text-sm font-bold text-foreground">Shop All Supplies</span>
              <p className="text-xs text-muted-foreground mt-0.5">Sleeves, binders, storage and display — sold by CardPop</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <div className="flex">
            {/* Parent categories — hover/focus opens the panel on the right */}
            <div className={`w-[292px] shrink-0 p-3 ${activeGroup ? 'border-r border-border' : ''}`}>
              {shopGroups.map(group => {
                const isActive = group.slug === activeSlug;
                return (
                  // The parent navigates to the group's supply collection page;
                  // hovering/focusing still expands its subcategory panel.
                  <Link
                    key={group.slug}
                    to={`/shop/${group.slug}`}
                    onPointerEnter={() => setActiveSlug(group.slug)}
                    onFocus={() => setActiveSlug(group.slug)}
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                      isActive ? 'bg-muted' : 'hover:bg-muted'
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${group.gradient} shrink-0 shadow-sm`}>
                      <group.Icon className="w-4 h-4 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-semibold transition-colors ${isActive ? 'text-primary' : 'text-foreground'}`}>
                        {group.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{group.navDesc}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ml-auto shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </Link>
                );
              })}
            </div>

            {/* Subcategories of the hovered category — absent until a
                category is hovered, then the panel expands out */}
            {activeGroup && (
              <div className="flex-1 min-w-0 p-3">
                <Link
                  to={`/shop/${activeGroup.slug}`}
                  onClick={() => { setOpen(false); onNavigate?.(); }}
                  className="flex items-center justify-between gap-2 mb-1.5 px-3 pt-1 group/head"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground group-hover/head:text-primary transition-colors">
                    {activeGroup.label}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 group-hover/head:opacity-100 transition-opacity">
                    View all <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
                <div className="grid gap-0.5">
                  {activeGroup.items.map(item => (
                    <Link
                      key={item.slug}
                      to={`/shop/category/${item.slug}`}
                      onClick={() => { setOpen(false); onNavigate?.(); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors group"
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${activeGroup.gradient} shrink-0 shadow-sm`}>
                        <item.Icon className="w-4 h-4 text-white" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Community mega-dropdown ──────────────────────────────────────────────────
// Also hosts Events and the blog ("The Parallel Report") since the top-level
// nav was consolidated to five sections.
const CommunityDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const { settings } = usePlatformSettings();
  const isCommunityActive = location.pathname.startsWith('/community')
    || location.pathname.startsWith('/events')
    || location.pathname.startsWith('/blog');

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
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[34rem] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
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
          <div className="p-3 grid grid-cols-2 gap-x-3">
            <div className="grid gap-0.5 content-start">
              <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Community</p>
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
            <div className="grid gap-0.5 content-start">
              <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Events</p>
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
              <Link
                to="/events"
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="px-3 py-2 text-[13px] font-semibold text-primary hover:underline"
              >
                Full event calendar →
              </Link>
              {settings.enable_blog !== false && (
                <>
                  <p className="px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reads</p>
                  <Link
                    to="/blog"
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shrink-0 shadow-sm">
                      <BookOpen className="w-4 h-4 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">The Parallel Report</p>
                      <p className="text-[11px] text-muted-foreground truncate">Guides, news and card stories</p>
                    </div>
                  </Link>
                </>
              )}
            </div>
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
        Prices
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
              <span className="text-sm font-bold text-foreground">Prices & Market Data</span>
              <p className="text-xs text-muted-foreground mt-0.5">What cards are worth, tracked in AUD</p>
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

// ─── More dropdown (secondary/informational links) ────────────────────────────
const MoreDropdown = ({ onNavigate }) => {
  const { open, setOpen, ref, handlePointerEnter, handlePointerLeave, handleTriggerClick } = useHoverDropdown();
  const location = useLocation();
  const isMoreActive = MORE_ITEMS.some(i => location.pathname === i.href || location.pathname.startsWith(i.href + '/'));

  return (
    <div className="relative" ref={ref} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        onClick={handleTriggerClick}
        aria-expanded={open}
        className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          open || isMoreActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        More
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 grid gap-0.5">
            {MORE_ITEMS.map(item => (
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
// Each parent category (Protection, Storage, Display, Shipping, Grading) is its
// own accordion: the subcategory list stays collapsed until that category is
// tapped, instead of dumping every group's items on screen at once.
const MobileShopSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const { groups: shopGroups } = useShopCategoryGroups();

  const toggleGroup = (slug) => {
    startTransition(() => {
      setOpenGroups(prev => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug); else next.add(slug);
        return next;
      });
    });
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          Supplies
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          <SheetClose asChild>
            <Link
              to="/shop"
              onClick={onNavigate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            >
              Shop All Supplies
            </Link>
          </SheetClose>
          {shopGroups.map(group => {
            const groupOpen = openGroups.has(group.slug);
            return (
              <div key={group.slug}>
                <button
                  onClick={() => toggleGroup(group.slug)}
                  aria-expanded={groupOpen}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${group.gradient} shrink-0`}>
                      <group.Icon className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground truncate">{group.label}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{group.navDesc}</span>
                    </span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
                </button>
                {groupOpen && (
                  <div className="grid gap-0.5 mb-1 ml-5 pl-2 border-l border-border">
                    <SheetClose asChild>
                      <Link
                        to={`/shop/${group.slug}`}
                        onClick={onNavigate}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-xs font-semibold text-primary"
                      >
                        View all {group.label}
                      </Link>
                    </SheetClose>
                    {group.items.map(item => (
                      <SheetClose key={item.slug} asChild>
                        <Link
                          to={`/shop/category/${item.slug}`}
                          onClick={onNavigate}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors text-left"
                        >
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${group.gradient} shrink-0`}>
                            <item.Icon className="w-3.5 h-3.5 text-white" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-foreground truncate">{item.name}</span>
                            <span className="block text-[11px] text-muted-foreground truncate">{item.desc}</span>
                          </span>
                        </Link>
                      </SheetClose>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
          {/* Events + blog live under Community now that the nav is five sections */}
          <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Events</p>
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
          <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reads</p>
          <SheetClose asChild>
            <Link
              to="/blog"
              onClick={onNavigate}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="text-xs font-semibold text-foreground truncate">The Parallel Report</span>
            </Link>
          </SheetClose>
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
          Prices
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

// ─── Mobile more section (expandable) ────────────────────────────────────────
const MobileMoreSection = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        onClick={() => startTransition(() => setOpen(o => !o))}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors mb-0.5"
      >
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <MoreHorizontal className="w-4 h-4 text-primary" />
          More
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mb-1 pl-2">
          {MORE_ITEMS.map(item => (
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
  const { settings } = usePlatformSettings();
  if (!currentUser) return null;
  return (
    <div className="w-full">
      <button
        className="w-full flex items-center gap-3 h-14 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/50 transition-colors"
        onClick={() => setExpanded(o => !o)}
      >
        <ProfileAvatar profile={currentUser} size="sm" name={currentUser.display_name || currentUser.name} />
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
          {settings.enable_trading !== false && (
            <SheetClose asChild>
              <Link to="/trade-requests" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
                <ArrowRightLeft className="w-4 h-4" /> Trade Requests
              </Link>
            </SheetClose>
          )}
          <SheetClose asChild>
            <Link to="/account/events" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <Calendar className="w-4 h-4" /> My Events
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link to="/account/shows" onClick={onNavigate} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-medium">
              <Tv2 className="w-4 h-4" /> My Shows
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
      {settings.enable_marketplace !== false && <BrowseDropdown onNavigate={onNavigate} />}
      {NAV_LINKS.map((link) => {
        if (link.label === 'Supplies') return <ShopDropdown key="shop" onNavigate={onNavigate} />;
        if (link.label === 'Prices') return <AnalyticsDropdown key="prices" onNavigate={onNavigate} />;
        if (link.label === 'Community') return <CommunityDropdown key="community" onNavigate={onNavigate} />;
        if (link.label === 'Grading') return <GradingDropdown key="grading" onNavigate={onNavigate} />;
        const isActive = isNavLinkActive(link, location.pathname);
        const isSell = link.label === 'Sell';
        return (
          <Link
            key={link.label}
            to={link.href}
            className={`px-2 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : isSell
                  ? 'text-primary font-bold hover:bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <MoreDropdown onNavigate={onNavigate} />
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

        {/* Sell CTA — primary marketplace action, surfaced up top on phones
            where the header's Sell button is hidden. */}
        <SheetClose asChild>
          <Button asChild className="w-full rounded-xl h-12 font-bold mb-4 gap-2">
            <Link to="/vault/add" onClick={onNavigate}>
              <Tag className="w-4 h-4" />
              Sell a Card
            </Link>
          </Button>
        </SheetClose>

        {/* Order mirrors the desktop Row-2 nav top-to-bottom: Marketplace
            leads, then NAV_LINKS in sequence — expandable sections (Prices,
            Community, Grading) and flat links interleaved so the mobile
            menu reads in the same order as the desktop bar reads left-to-right.
            key={openKey} resets accordion state each time the menu opens. */}
        <nav className="flex flex-col mb-6">
          {settings.enable_marketplace !== false && <MobileBrowseSection key={openKey} onNavigate={onNavigate} />}

          {NAV_LINKS.map((link) => {
            if (link.label === 'Supplies') return <MobileShopSection key={`shop-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Prices') return <MobileAnalyticsSection key={`prices-${openKey}`} onNavigate={onNavigate} />;
            if (link.label === 'Community') return <MobileCommunitySection key={`community-${openKey}`} onNavigate={onNavigate} />;
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
          <MobileMoreSection key={`more-${openKey}`} onNavigate={onNavigate} />
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
            {settings.enable_trading !== false ? (
              <SheetClose asChild>
                <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold">
                  <Link to="/trade-requests" className="flex items-center gap-2 text-xs px-1">
                    <ArrowRightLeft className="w-4 h-4" />
                    Trades
                    {tradeCount > 0 && <Badge className="ml-1 bg-accent text-accent-foreground px-1">{tradeCount}</Badge>}
                  </Link>
                </Button>
              </SheetClose>
            ) : (
              // Trading hidden: give the slot to Messages, which on phones
              // otherwise only exists deep in the account section.
              <SheetClose asChild>
                <Button asChild variant="outline" className="w-full justify-center rounded-xl h-12 font-bold">
                  <Link to="/messaging" className="flex items-center gap-2 text-xs px-1">
                    <MessageSquare className="w-4 h-4" />
                    Messages
                  </Link>
                </Button>
              </SheetClose>
            )}
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
                <Link to="/signup">Sign Up — It's Free</Link>
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
