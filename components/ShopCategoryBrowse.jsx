// On-page "Shop by Category" browser for /shop. The five overarching shop
// categories are a compact tab strip; the active one's subcategories sit in a
// single row of links underneath, so the whole browser stays a couple of lines
// tall and the product grid starts near the top of the page. A tab activates on
// hover (mouse), tap or keyboard focus.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';

const ShopCategoryBrowse = () => {
  const [activeSlug, setActiveSlug] = useState(SHOP_CATEGORY_GROUPS[0].slug);
  const activeGroup =
    SHOP_CATEGORY_GROUPS.find((g) => g.slug === activeSlug) || SHOP_CATEGORY_GROUPS[0];

  // Only mouse pointers open-on-hover — touch taps go through onClick so a tap
  // doesn't both hover and click the same tab.
  const handlePointerEnter = (slug) => (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    setActiveSlug(slug);
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 sm:px-4 py-2.5">
        <div className="flex flex-1 min-w-0 flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide">
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
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
                  isActive
                    ? `bg-gradient-to-br ${group.gradient} text-white shadow-sm`
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <group.Icon className="h-4 w-4" />
                {group.label}
              </button>
            );
          })}
        </div>
        <Link
          to={`/shop/${activeGroup.slug}`}
          className="hidden sm:inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline"
        >
          View all {activeGroup.label} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible scrollbar-hide px-3 sm:px-4 py-3">
        {activeGroup.items.map((item) => (
          <Link
            key={item.slug}
            to={`/shop/category/${item.slug}`}
            title={item.desc}
            className="group/link inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background py-1.5 pl-1.5 pr-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${activeGroup.gradient}`}
            >
              <item.Icon className="h-3.5 w-3.5 text-white" />
            </span>
            {item.name}
          </Link>
        ))}
        <Link
          to={`/shop/${activeGroup.slug}`}
          className="sm:hidden inline-flex shrink-0 items-center gap-1 px-2 text-sm font-bold text-primary"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

export default ShopCategoryBrowse;
