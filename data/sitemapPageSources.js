// Which source files make up each static page in the sitemap (api/sitemap.js).
//
// A static page's <lastmod> is the last day one of its source files changed —
// recorded in data/sitemapPageDates.js by `npm run sitemap:dates`, never typed
// by hand. Until 2026-11 these pages shared one hard-coded date that nobody
// bumped (the Terms were rewritten and still said May), and Google stops
// trusting every lastmod in a sitemap once some of them are wrong.
//
// List the page component here; its direct `@/data/…` and `@/config/…` imports
// and the shared policy files it reads are added automatically
// (tools/sitemapPageDates.mjs). Add a file by hand only when the page's words
// live somewhere the component doesn't import directly.
//
// A key ending in `/*` covers every page under that prefix that has no entry
// of its own. tests/backend/sitemapPageDates.test.js fails when a static page
// has no entry here, or when a source file changed and the dates file wasn't
// regenerated.
//
// Pages that also show live data (the shop, the marketplace, the blog index…)
// are dated by whichever is newer: this file date, or the newest row they list.

import { SHOP_COLLECTION_SLUGS } from './shopCollectionSeo.js';

export const STATIC_PAGE_SOURCES = {
  '/': ['pages/HomePage.jsx', 'tools/home-shell.html'],
  '/marketplace': ['pages/marketplace/MarketplacePage.jsx'],
  '/shop': ['pages/shop/ShopPage.jsx'],
  '/shop/sealed-boxes': ['pages/shop/ShopSealedBoxesPage.jsx'],
  '/shop/singles': ['pages/shop/ShopSinglesPage.jsx'],
  '/shop/binders': ['pages/shop/ShopBindersHubPage.jsx', 'data/shopBinderProducts.js'],
  '/shop/binders/*': ['pages/shop/ShopBinderProductPage.jsx', 'data/shopBinderProducts.js'],
  // The supply collection pages, /shop/<group>.
  ...Object.fromEntries(SHOP_COLLECTION_SLUGS.map((slug) => (
    [`/shop/${slug}`, ['pages/shop/ShopCollectionPage.jsx', 'data/shopCollectionSeo.js']]
  ))),
  // The Palms Off Gaming catalogue lines at /shop/<category>/<line>.
  '/shop/*': ['pages/shop/ShopProductPage.jsx', 'data/palmsOffCatalogue.js'],
  '/analytics': ['pages/markets/MarketsPage.jsx'],
  '/analytics/buying-guides': ['pages/analytics/BuyingGuidesPage.jsx', 'data/buyingGuides.js'],
  '/analytics/buying-guides/*': ['pages/analytics/BuyingGuideDetailPage.jsx', 'data/buyingGuides.js'],
  '/prices': ['pages/prices/CardPricesHubPage.jsx'],
  '/prices/*': ['pages/prices/CardPricesHubPage.jsx'],
  '/scan': ['pages/ScanPage.jsx'],
  '/australian-markets': ['pages/AustralianMarketsPage.jsx'],
  '/grading': ['pages/grading/GradingPage.jsx'],
  '/grading/what-is-grading': ['pages/grading/WhatIsGradingPage.jsx'],
  '/grading/scales': ['pages/grading/GradingScalesPage.jsx', 'data/gradingScales.js'],
  '/grading/scales/*': ['pages/grading/GradingScalePage.jsx', 'data/gradingScales.js'],
  '/grading/companies': ['pages/grading/GradingCompaniesPage.jsx', 'data/gradingCompanies.js'],
  '/grading/local-graders': ['pages/grading/LocalGradersPage.jsx'],
  '/grading/submission-partners': [
    'pages/grading/SubmissionPartnersPage.jsx', 'data/gradingPartnersSeed.js', 'data/gradingCompanies.js',
  ],
  '/grading/estimator': ['pages/grading/GradeEstimatorPage.jsx'],
  '/grading/roi-calculator': ['pages/grading/GradingROIPage.jsx'],
  '/community': ['pages/community/CommunityPage.jsx'],
  '/community/local-traders': ['pages/community/LocalTradersPage.jsx'],
  '/community/building-your-business': ['pages/community/BuildingYourBusinessPage.jsx'],
  '/events': ['pages/community/CommunityEventsPage.jsx'],
  '/events/*': ['pages/community/CommunityEventsPage.jsx'],
  '/blog': ['pages/blog/BlogPage.jsx', 'data/blogCategories.js'],
  '/blog/category/*': ['pages/blog/BlogPage.jsx', 'data/blogCategories.js'],
  '/about': ['pages/info/AboutPage.jsx'],
  '/partners': ['pages/partners/PartnersPage.jsx'],
  '/list-your-event': ['pages/community/ListYourEventPage.jsx', 'utils/featuredPackages.js'],
  '/pricing': ['pages/PricingPage.jsx', 'config/plans.js', 'config/subscription.js'],
  '/photography-standard': ['pages/info/PhotographyStandardPage.jsx'],
  '/contact': ['pages/info/ContactPage.jsx'],
  '/faq': ['pages/info/FAQPage.jsx'],
  '/conviction-rating': ['pages/info/ConvictionRatingPage.jsx'],
  '/privacy-policy': ['pages/PrivacyPolicyPage.jsx'],
  '/terms': ['pages/info/TermsPage.jsx', 'data/termsOfService.js'],
  '/returns': ['pages/info/ReturnsPage.jsx'],
  '/shipping': ['pages/info/ShippingPage.jsx'],
  '/trust-safety': ['pages/info/TrustSafetyPage.jsx'],
  '/safe-buying': ['pages/info/SafeBuyingPage.jsx'],
  '/accessibility': ['pages/info/AccessibilityPage.jsx'],
  '/collections': ['pages/PublicCollectionsPage.jsx', 'data/collectionSeo.js'],
  '/collections/*': ['pages/collections/CollectionPage.jsx', 'data/collectionSeo.js'],
};

// The entry that dates `loc`: its own, else the longest `/*` family it is under.
export function sourceKeyFor(loc, sources = STATIC_PAGE_SOURCES) {
  if (sources[loc]) return loc;
  let best = '';
  for (const key of Object.keys(sources)) {
    if (!key.endsWith('/*')) continue;
    const prefix = key.slice(0, -1);
    if (loc.startsWith(prefix) && key.length > best.length) best = key;
  }
  return best || null;
}

// lastmod for a static page from the generated dates (data/sitemapPageDates.js).
export function staticPageLastmod(loc, dates, sources = STATIC_PAGE_SOURCES) {
  const key = sourceKeyFor(loc, sources);
  return (key && dates?.[key]?.lastmod) || null;
}
