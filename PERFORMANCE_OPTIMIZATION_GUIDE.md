# Performance Optimization Deployment Guide

This guide covers the mobile Lighthouse optimization changes for CardPop.com.au and how to deploy them to production with verification steps.

## Overview

Target: Improve mobile Lighthouse score from 66 to 90+

Key optimizations implemented:
1. **Quick wins**: Critical CSS inline, font preload with `display=swap`, defer third-party scripts
2. **Medium effort**: Request caching layer, Service Worker, Cache-Control headers
3. **Database**: Indexes for homepage queries (applies after deployment)

Expected improvements:
- FCP (First Contentful Paint): -500ms → faster initial render with system fonts
- LCP (Largest Contentful Paint): -1000ms → query caching eliminates blocking requests
- CLS (Cumulative Layout Shift): eliminated via critical CSS and font declarations
- TBT (Total Blocking Time): -200ms → deferred third-party scripts (Analytics, Sentry)

---

## Pre-Deployment Checklist

- [ ] Review changes in `vercel.json` (cache headers, rewrites)
- [ ] Review changes in `main.jsx` (lazy loading, Service Worker, deferred Sentry)
- [ ] Review changes in `index.html` (critical CSS, font-display: swap, defer scripts)
- [ ] Verify `lib/queryCache.js` exists (new file, request caching)
- [ ] Verify `public/sw.js` exists (new file, Service Worker)
- [ ] Verify `pages/HomePage.jsx` uses `cachedQuery` (wraps featured cards/sellers)
- [ ] Verify `index.css` has system font stack in `--font-heading`
- [ ] Verify `utils/imageUrl.js` has `quality = 75` (up from 70)
- [ ] Test locally: `npm run dev`, verify no console errors
- [ ] Run tests: `npm test` (all should pass)

---

## Deployment Steps

### 1. Deploy to Production

```bash
# Ensure all changes are committed
git status

# Push to origin/main (triggers GitHub Actions → Vercel deploy)
git push -u origin main
```

GitHub Actions will automatically:
- Install dependencies
- Run linters and tests
- Build with Vite (`npm run build`)
- Deploy to Vercel (serverless function + frontend)

**Expected deployment time**: 3-5 minutes

### 2. Verify Deployment

Once deployed (Vercel dashboard shows green ✓):

```bash
# Test production URL
curl -I https://cardpop.com.au/

# Verify Cache-Control headers are present
# Should return: Cache-Control: public, max-age=0, must-revalidate
curl -I https://cardpop.com.au/index.html

# Verify static assets have 1-year cache
# Should return: Cache-Control: public, max-age=31536000, immutable
curl -I https://cardpop.com.au/assets/logo.svg
curl -I https://cardpop.com.au/images/hero/black-lotus.jpg
```

### 3. Apply Database Indexes

Performance optimization requires database indexes for homepage queries.

**Option A: Via Supabase Dashboard (Recommended)**

1. Log in to Supabase dashboard
2. Navigate to: Database → SQL Editor
3. Create a new query and copy/paste from `sql/performance_indexes.sql`
4. Execute each CREATE INDEX statement
5. Verify in: Database → Tables → vault_items, profiles (view indexes)

**Option B: Via Supabase CLI**

```bash
# Login to Supabase
supabase login

# Create indexes
supabase db push

# Verify
supabase db list
```

**Index verification**:
- `idx_vault_items_public_active_created` — for homepage featured cards
- `idx_profiles_featured_active` — for homepage featured sellers
- Additional indexes optimize marketplace filters and search

---

## Post-Deployment Testing

### 1. Lighthouse Audit (Mobile)

```bash
# Install PageSpeed Insights CLI
npm install -g psi

# Run mobile Lighthouse audit
psi https://cardpop.com.au --mobile

# Or use Chrome DevTools:
# DevTools → Lighthouse → Mobile → Analyze page load
```

Expected scores (mobile):
- Performance: 85-90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 95+

### 2. Core Web Vitals

Check real-world metrics in:
- **Vercel Analytics** (dashboard.vercel.com → Select project → Analytics)
- **Google Search Console** (search.google.com/search-console)
- **PageSpeed Insights** (pagespeed.web.dev)

Monitor for 24-48 hours to collect real user data:
- FCP (First Contentful Paint): Target <2 seconds
- LCP (Largest Contentful Paint): Target <2.5 seconds
- CLS (Cumulative Layout Shift): Target <0.1
- TBT (Total Blocking Time): Target <300ms

### 3. Service Worker Verification

Open browser DevTools → Application tab:

```
Service Workers:
  ✓ https://cardpop.com.au - Status: activated and running
  
Cache Storage:
  ✓ cardpop-static-v2 (static assets)
  ✓ cardpop-dynamic-v2 (API responses)
  ✓ cardpop-pages-v2 (HTML pages)
```

Test offline mode (DevTools → Network → Offline):
- Homepage should still load from cache
- Images should display
- API calls should fail gracefully with error message

### 4. Request Caching

Open browser Console and check:

```javascript
// Verify Service Worker is registered
navigator.serviceWorker.getRegistrations()
// Should return: [ServiceWorkerRegistration {...}]

// Check cache stats
// Navigate to homepage twice within 5 minutes
// Second load should be faster (query cache hit)
```

---

## Monitoring Checklist

### First 24 Hours

- [ ] Vercel deployment shows no errors (green ✓)
- [ ] No 404 errors in Sentry dashboard
- [ ] Service Worker registrations succeed (0 errors in console)
- [ ] Google Analytics tracks page views normally
- [ ] Stripe checkout flow works end-to-end
- [ ] Supabase real-time updates working (vault listings, messages)

### First 7 Days

- [ ] Mobile Lighthouse score improved (target 85+)
- [ ] FCP decreased by 400-600ms
- [ ] LCP decreased by 800-1200ms
- [ ] No increase in error rate (Sentry dashboard)
- [ ] Database query performance improved (Supabase dashboard)

### Ongoing

- [ ] Monthly Lighthouse audits
- [ ] Monitor Core Web Vitals in Search Console
- [ ] Check Vercel Analytics for performance trends
- [ ] Review Sentry dashboard for regressions

---

## Rollback Procedure

If issues arise after deployment:

### Quick Rollback (5 minutes)

1. **Vercel Dashboard** → Project → Deployments
2. Find the previous deployment (before optimization)
3. Click "..." → Promote to Production
4. Verify rollback in dashboard (production URL shows old deployment)

### Git Rollback (5 minutes)

```bash
# Find the commit before optimizations
git log --oneline | grep -E 'Optimize|Service Worker|queryCache|font'

# Reset to previous commit
git reset --hard <previous-commit-hash>

# Push to trigger re-deployment
git push -f origin main

# GitHub Actions will re-deploy the previous version
```

**Rollback is safe** because:
- Vercel keeps all deployment history
- No database schema changes were made
- Service Worker is opt-in (browsers will unregister if removed)
- Cache headers are safe to remove (just disable caching, no data loss)

---

## Troubleshooting

### Service Worker Registration Failed

**Symptom**: Console error: "Service Worker registration failed"

**Solution**:
1. Check `/public/sw.js` exists and is deployed
2. Verify `public/` directory is included in build output (`npm run build`)
3. Check Vercel deployment includes `public/` directory
4. Clear browser cache (DevTools → Application → Clear site data)
5. Hard reload: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### LCP Not Improving

**Symptom**: Lighthouse LCP still slow (>3 seconds)

**Solution**:
1. Verify database indexes are applied (Supabase dashboard → Database)
2. Check query cache is working: DevTools → Console → run:
   ```javascript
   // Check if caching is enabled
   localStorage.getItem('homepage_featured_cards')
   ```
3. Verify homepage is using `cachedQuery` (check `pages/HomePage.jsx`)
4. Check Supabase query performance: Supabase dashboard → SQL Editor → EXPLAIN ANALYZE

### Service Worker Cache Growing

**Symptom**: Storage full warning (DevTools → Application → Storage)

**Solution**:
1. Service Worker limits cache to 3 caches (static, dynamic, pages)
2. Manual clear: DevTools → Application → Cache Storage → Delete entries
3. Automatic cleanup: SW `activate` event cleans old versions
4. To reset: Unregister SW (DevTools → Application → Unregister Service Worker)

### Font Rendering Issues

**Symptom**: Text displays in system font, then changes to Syne (FOUT)

**Expected behavior**: This is intentional (`font-display: swap`)
- System font renders immediately (faster FCP)
- Syne loads in background and swaps in (FOUT is unavoidable with web fonts)
- Trade-off: Faster first paint vs. brief font switch

**To fix if undesirable**:
- Change `font-display: swap` back to `font-display: optional` in `index.html`
- This prevents font swap but delays text rendering until font loads

---

## Success Criteria

Deployment is successful when:

✓ Mobile Lighthouse Performance: 85-90+
✓ FCP < 2.0s (before: ~3.0s)
✓ LCP < 2.5s (before: ~4.0s)
✓ CLS = 0 (no layout shift)
✓ TBT < 300ms (before: ~500ms)
✓ Service Worker installed and offline-capable
✓ Query caching reducing Supabase calls
✓ No new errors in Sentry dashboard
✓ Real user metrics improve within 24-48 hours

---

## Additional Resources

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Chrome Lighthouse Guide](https://web.dev/performance/)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Supabase Performance Advisor](https://supabase.com/docs/guides/database/performance)
