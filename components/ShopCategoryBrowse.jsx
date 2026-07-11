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
      {/* Overarching category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
              className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${group.gradient} aspect-square shadow-sm transition-all duration-200 text-center leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? 'ring-2 ring-foreground/30 ring-offset-2 ring-offset-background shadow-lg -translate-y-1'
                  : 'hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              <group.Icon className="w-9 h-9 text-white drop-shadow-sm" />
              <span className="text-[11px] sm:text-xs font-bold leading-tight text-white drop-shadow-sm">
                {group.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Subcategories for the active category */}
      <div className="mt-4 bg-card border border-border rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${activeGroup.gradient} shadow-sm shrink-0`}
          >
            <activeGroup.Icon className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-lg leading-tight">{activeGroup.label}</h3>
            <p className="text-sm text-muted-foreground">{activeGroup.blurb}</p>
          </div>
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
