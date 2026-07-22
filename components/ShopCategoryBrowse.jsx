// On-page "Shop by Category" browser for /shop. Shows the five overarching
// shop categories as gradient icon cards (matching the homepage "Browse by
// Category" cards), and reveals that category's subcategories below when a card
// is hovered (desktop) or tapped/focused (touch + keyboard).
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';

const ShopCategoryBrowse = () => {
  const [activeSlug, setActiveSlug] = useState(SHOP_CATEGORY_GROUPS[0].slug);
  const activeGroup =
    SHOP_CATEGORY_GROUPS.find((g) => g.slug === activeSlug) || SHOP_CATEGORY_GROUPS[0];

  // Only mouse pointers open-on-hover — touch taps go through onClick so a tap
  // doesn't both hover and click the same card.
  const handlePointerEnter = (slug) => (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    setActiveSlug(slug);
  };

  return (
    <div>
      {/* Overarching category cards — compact so they read as a control strip,
          not full-bleed banners. Mobile: single-row touch carousel (matches the
          homepage "Browse by Category" mobile strip). Desktop: centered, wraps. */}
      <div className="flex flex-nowrap sm:flex-wrap justify-start sm:justify-center gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none scroll-px-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 py-2 sm:py-0">
        {SHOP_CATEGORY_GROUPS.map((group) => {
          const isActive = group.slug === activeSlug;
          return (
            <button
              key={group.slug}
              type="button"
              onPointerEnter={handlePointerEnter(group.slug)}
              onClick={() => setActiveSlug(group.slug)}
              onFocus={() => setActiveSlug(group.slug)}
              aria-pressed={isActive}
              aria-label={`${group.label} supplies`}
              className={`group flex flex-shrink-0 snap-start flex-col items-center justify-center gap-1.5 w-[88px] h-[88px] rounded-xl bg-gradient-to-br ${group.gradient} shadow-sm transition-all duration-200 text-center leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? 'ring-2 ring-foreground/30 ring-offset-2 ring-offset-background shadow-lg -translate-y-0.5'
                  : 'hover:shadow-lg hover:-translate-y-0.5'
              }`}
            >
              <group.Icon className="w-5 h-5 text-white drop-shadow-sm" />
              <span className="text-[10px] font-bold leading-tight text-white drop-shadow-sm px-1">
                {group.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Subcategories for the active category */}
      <div className="mt-8 bg-card border border-border rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${activeGroup.gradient} shadow-sm shrink-0`}
          >
            <activeGroup.Icon className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg leading-tight">{activeGroup.label}</h3>
            <p className="text-sm text-muted-foreground">{activeGroup.blurb}</p>
          </div>
          <Link
            to={`/shop/${activeGroup.slug}`}
            className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {activeGroup.items.map((item) => (
            <Link
              key={item.slug}
              to={`/shop/category/${item.slug}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted/40 transition-colors group/link"
            >
              <span
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${activeGroup.gradient} shadow-sm shrink-0`}
              >
                <item.Icon className="w-4 h-4 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground group-hover/link:text-primary transition-colors truncate">
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/link:text-primary group-hover/link:translate-x-0.5 transition-all shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShopCategoryBrowse;
