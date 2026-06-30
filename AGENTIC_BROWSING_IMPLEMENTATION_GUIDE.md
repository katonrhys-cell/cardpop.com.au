# Agentic Browsing Phase 2: Implementation Guide

**Objective:** Achieve 3/3 score on PageSpeed Insights Agentic Browsing audit

**Timeline:** 1-2 weeks
**Effort:** ~8-16 hours
**Complexity:** Low to Medium

---

## Quick Start: 4 Key Changes

### Change 1: Add Organization Schema (30 min)
**File:** `App.jsx`
**Impact:** Helps AI agents understand CardPop's identity
**Difficulty:** Easy

**Location:** Add to the global Helmet tag (already in App.jsx)

```jsx
// In App.jsx, add to the Helmet component:
<Helmet>
  <title>CardPop - Australian Trading Card Marketplace</title>
  {/* ... existing meta tags ... */}
  
  {/* Add structured data for Organization */}
  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "CardPop",
      "alternateName": "Card Pop",
      "url": "https://cardpop.com.au",
      "logo": "https://cardpop.com.au/logo.png",
      "description": "Australian trading card marketplace for collectors",
      "sameAs": [
        "https://twitter.com/cardpop",
        "https://instagram.com/cardpop_au"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Customer Service",
        "email": "hello@cardpop.com.au"
      },
      "areaServed": "AU",
      "priceRange": "$$"
    })}
  </script>
</Helmet>
```

**Verification:**
```bash
# Visit homepage and check source for script tag
curl https://cardpop.com.au | grep -A 10 "Organization"
```

---

### Change 2: Add BreadcrumbList to Collections (1 hour)

**Files:** 
- `pages/collections/CollectionPage.jsx`

**Impact:** Helps AI agents understand collection hierarchy
**Difficulty:** Easy

**Implementation:**

```jsx
// At the top of CollectionPage.jsx render, add:

const BreadcrumbSchema = ({ categoryName }) => (
  <Helmet>
    <script type="application/ld+json">
      {JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://cardpop.com.au"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Collections",
            "item": "https://cardpop.com.au/collections"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": categoryName,
            "item": `https://cardpop.com.au/collections/${slug}`
          }
        ]
      })}
    </script>
  </Helmet>
);

// In the return JSX:
return (
  <>
    <BreadcrumbSchema categoryName={name} />
    {/* ... rest of component ... */}
  </>
);
```

**Also add visual breadcrumbs:**

```jsx
// Add this before the hero section:
<nav className="bg-muted/50 border-b border-border py-3 px-4">
  <div className="container mx-auto">
    <ol className="flex items-center gap-2 text-sm">
      <li><Link to="/" className="text-primary hover:underline">Home</Link></li>
      <li className="text-muted-foreground">/</li>
      <li><Link to="/collections" className="text-primary hover:underline">Collections</Link></li>
      <li className="text-muted-foreground">/</li>
      <li className="text-foreground font-medium">{name}</li>
    </ol>
  </div>
</nav>
```

**Verification:**
1. Visit `/collections/pokemon`
2. Check page source for BreadcrumbList JSON-LD
3. Visit https://validator.schema.org and paste page HTML

---

### Change 3: Add Product Schema to Listings (2 hours)

**Files:**
- `components/MarketplaceListingCard.jsx` (or equivalent)

**Impact:** Helps AI agents understand product details and pricing
**Difficulty:** Medium

**Implementation:**

```jsx
// In the MarketplaceListingCard component:

const ProductSchema = ({ listing, seller }) => (
  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": listing.title,
      "description": listing.description || `${listing.card_name} - ${listing.condition}`,
      "image": listing.image_url,
      "brand": listing.set_name || "Trading Card",
      "offers": {
        "@type": "Offer",
        "url": `https://cardpop.com.au/product/${listing.id}`,
        "priceCurrency": "AUD",
        "price": listing.price_aud.toString(),
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Person",
          "name": seller?.display_name || "Seller"
        }
      },
      "aggregateRating": seller?.average_rating ? {
        "@type": "AggregateRating",
        "ratingValue": seller.average_rating.toString(),
        "reviewCount": seller.review_count || 0
      } : undefined
    })}
  </script>
);

// In your JSX:
return (
  <>
    <ProductSchema listing={listing} seller={seller} />
    {/* ... rest of card ... */}
  </>
);
```

**Notes:**
- Render this schema only on card detail pages, not in grid
- Ensure all fields match actual data
- Remove undefined fields from JSON

**Verification:**
1. Navigate to a listing detail page
2. Check HTML source for Product schema
3. Validate with https://validator.schema.org

---

### Change 4: Add Visual Breadcrumbs to Other Pages (1 hour)

**Files to update:**
- `pages/markets/CardAnalyticsPage.jsx`
- `pages/community/LocalMapPage.jsx`
- `pages/blog/*` (blog pages)
- `pages/info/*` (info pages)

**Component to create:**

```jsx
// Create: components/BreadcrumbNav.jsx

import React from 'react';
import { Link } from 'react-router-dom';

export const BreadcrumbNav = ({ items }) => (
  <nav className="bg-muted/50 border-b border-border py-3 px-4 mb-8">
    <div className="container mx-auto">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <li className="text-muted-foreground">/</li>}
            <li>
              {item.href ? (
                <Link to={item.href} className="text-primary hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </div>
  </nav>
);

// Usage:
<BreadcrumbNav items={[
  { label: 'Home', href: '/' },
  { label: 'Markets', href: '/markets' },
  { label: 'Card Analytics' }
]} />
```

**Apply to:**
- CardAnalyticsPage: `Home > Markets > Card Analytics`
- LocalMapPage: `Home > Community > Local Map`
- BlogPage: `Home > Blog > Article Title`
- InfoPage: `Home > Info > Guide Title`

---

## Testing & Validation

### Step 1: Local Testing

```bash
# Start dev server
npm run dev

# Check each page for breadcrumbs in browser
# - http://localhost:3000/collections/pokemon
# - http://localhost:3000/markets/card-analytics
# - http://localhost:3000/community/local-map
```

### Step 2: Schema Validation

1. Visit https://validator.schema.org
2. Enter your deployed page URL
3. Verify no errors in structured data
4. Check that BreadcrumbList and Product schemas appear

### Step 3: PageSpeed Insights Check

```bash
# Visit (replace with production URL):
https://pagespeed.web.dev/?url=https://cardpop.com.au&form_factor=mobile

# Look for "Agentic Browsing" section
# Should show 3/3 if all structured data is correct
```

### Step 4: AI Agent Testing

```bash
# Test as if you're an AI agent
curl -H "User-Agent: GPTBot/1.0" https://cardpop.com.au/collections/pokemon
curl -H "User-Agent: CCBot" https://cardpop.com.au/markets/card-analytics
```

---

## Checklist

### Before Starting
- [ ] Review this guide completely
- [ ] Understand structured data concepts (Schema.org)
- [ ] Set up local development environment
- [ ] Create feature branch for this work

### Phase 2 Implementation

#### Organization Schema (30 min)
- [ ] Edit `App.jsx` Helmet component
- [ ] Add Organization JSON-LD script tag
- [ ] Test locally
- [ ] Validate schema

#### BreadcrumbList (1 hour)
- [ ] Update `CollectionPage.jsx`
- [ ] Add JSON-LD BreadcrumbList schema
- [ ] Add visual breadcrumb navigation
- [ ] Test on `/collections/*` pages
- [ ] Validate schema

#### Product Schema (2 hours)
- [ ] Identify listing detail page component
- [ ] Create ProductSchema component
- [ ] Add to listing pages
- [ ] Ensure data accuracy
- [ ] Test on listing detail pages
- [ ] Validate schema

#### Visual Breadcrumbs (1 hour)
- [ ] Create `BreadcrumbNav.jsx` component
- [ ] Add to 4+ pages:
  - [ ] CardAnalyticsPage
  - [ ] LocalMapPage
  - [ ] BlogPage
  - [ ] InfoPage
- [ ] Test all breadcrumbs render correctly

### After Implementation
- [ ] Run full test suite: `npm test -- --run`
- [ ] Check ESLint: `npm run lint`
- [ ] Test locally: `npm run dev`
- [ ] Commit changes
- [ ] Push to feature branch
- [ ] Wait 24-48 hours for PageSpeed cache refresh
- [ ] Re-run PageSpeed Insights
- [ ] Verify 3/3 score achieved

---

## Common Issues & Solutions

### Issue: "ReferenceError: Helmet is not imported"

**Solution:**
```jsx
import { Helmet } from 'react-helmet';
```

### Issue: "JSON.stringify fails on circular objects"

**Solution:**
```jsx
// Don't pass components, use plain objects:
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  // ... plain data only
})}
```

### Issue: "Schema validation fails with extra fields"

**Solution:**
```jsx
// Remove undefined/null fields:
{
  aggregateRating: seller?.rating ? { /* ... */ } : undefined,
  // This will be removed by JSON.stringify
}
```

### Issue: "Breadcrumbs not showing visually"

**Solution:**
- Check CSS classes are correct
- Verify Tailwind is configured
- Use browser DevTools to inspect elements
- Check for CSS conflicts

---

## Performance Notes

### Impact of Changes
- **Organization Schema:** +1KB to page size (negligible)
- **BreadcrumbList:** +0.5KB per page (negligible)
- **Product Schema:** +1-2KB per listing (justified)
- **Visual Breadcrumbs:** +0.5KB CSS/JSX (negligible)

**Total Impact:** <5KB per page = minimal performance impact

### Optimization Tips
1. Use `JSON.stringify` in React (not dangerouslySetInnerHTML)
2. Lazy-load schema data if component is below fold
3. Reuse schema components for consistency
4. Cache schema data when possible

---

## Rollback Plan

If issues occur:

```bash
# Option 1: Revert specific file
git checkout HEAD -- pages/collections/CollectionPage.jsx

# Option 2: Revert entire branch
git reset --hard origin/main

# Option 3: Selective rollback
git revert <commit-hash>
```

---

## Next Steps After Phase 2

Once 3/3 is achieved:

1. **Monitor** PageSpeed Insights monthly
2. **Gather** feedback from AI agents (in llms.txt contact form)
3. **Implement** Phase 3 improvements (FAQ, Events schemas)
4. **Consider** Phase 4 (Custom API tier for AI agents)

---

## Questions?

- **Technical Issues:** Refer to Schema.org docs
- **Implementation Help:** See example in each section
- **CardPop Questions:** developers@cardpop.com.au

---

**Happy implementing!** 🚀
