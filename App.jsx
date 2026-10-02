
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import Toaster from '@/components/ToasterLazy.jsx';

// Contexts
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import { AdminProvider } from '@/contexts/AdminContext.jsx';
import { CartProvider } from '@/hooks/useCart.jsx';
import { CategoryHierarchyProvider } from '@/contexts/CategoryContext.jsx';
import { WatchlistProvider } from '@/contexts/WatchlistContext.jsx';
import { PlatformSettingsProvider } from '@/contexts/PlatformSettingsContext.jsx';

// Layouts & Core Components
import Header from '@/components/Header.jsx';
// Footer sits below the fold and pulls NewsletterSignup → sonner. Lazy-loading
// keeps that (and the toast library) off the initial critical path; it hydrates
// as the page settles, well before the user can scroll to it.
const Footer = lazy(() => import('@/components/Footer.jsx'));
import ScrollToTop from '@/components/ScrollToTop.jsx';
import AnalyticsPageViews from '@/components/AnalyticsPageViews.jsx';
import AdsenseRouteLoader from '@/components/AdsenseRouteLoader.jsx';
import GoogleReviewsBadgeLoader from '@/components/GoogleReviewsBadgeLoader.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import ProtectedAdminRoute from '@/components/ProtectedAdminRoute.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import PageLoader from '@/components/PageLoader.jsx';
// Eager, framer-motion-free homepage hero. Used as the "/" route's Suspense
// fallback so the LCP <h1> paints on React's first commit — matching the static
// shell baked into index.html — instead of flashing a spinner while HomePage
// (and framer-motion) lazy-load.
import HeroSection from '@/components/HeroSection.jsx';
// Same idea for /launch in coming-soon builds (the "/" redirect target): the
// eager hero fallback matches the static launch shell so no spinner flashes
// while LaunchPage lazy-loads. Tree-shaken out of non-coming-soon builds.
import LaunchHero from '@/components/LaunchHero.jsx';
import ShoppingCart from '@/components/ShoppingCartLazy.jsx';
import AdminLayout from '@/components/AdminLayout.jsx';
import MarketplaceListingRedirect from '@/components/MarketplaceListingRedirect.jsx';
import ReferralCapture from '@/components/ReferralCapture.jsx';
import FeatureRoute from '@/components/FeatureRoute.jsx';
import MaintenanceGate from '@/components/MaintenanceGate.jsx';

// ==========================================
// LAZY LOADED PAGES (Performance Optimized)
// ==========================================

// Core & Auth
const HomePage = lazy(() => import('@/pages/HomePage.jsx'));
const LaunchPage = lazy(() => import('@/pages/LaunchPage.jsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage.jsx'));
const SignupPage = lazy(() => import('@/pages/SignupPage.jsx'));
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage.jsx'));
const LogoutPage = lazy(() => import('@/pages/LogoutPage.jsx'));
const VerificationPendingPage = lazy(() => import('@/pages/VerificationPendingPage.jsx'));
const ProfileCompletionPage = lazy(() => import('@/pages/ProfileCompletionPage.jsx'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage.jsx'));

// Collections
const CollectionPage = lazy(() => import('@/pages/collections/CollectionPage.jsx'));
// Forces CollectionPage to fully remount when the slug changes, resetting all filter/state
const CollectionRoute = () => { const { collectionSlug } = useParams(); return <CollectionPage key={collectionSlug} />; };

// Redirects /community/events/:eventId → /events/:eventId
const RedirectEventDetail = () => { const { eventId } = useParams(); return <Navigate to={`/events/${eventId}`} replace />; };

// Pre-launch mode: while VITE_COMING_SOON=true the homepage redirects to the
// /launch email-capture page. Deep links to every other page keep working, and
// /launch itself stays reachable regardless of the flag. Flip the env var off
// in Vercel (and redeploy) on launch day.
const COMING_SOON = import.meta.env.VITE_COMING_SOON === 'true';

// Resets the error boundary on every route change so a page error doesn't persist to other pages
const RouteErrorBoundary = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

// Marketplace
const MarketplacePage = lazy(() => import('@/pages/marketplace/MarketplacePage.jsx'));

// Shop
const ShopPage = lazy(() => import('@/pages/shop/ShopPage.jsx'));
const ShopSealedBoxesPage = lazy(() => import('@/pages/shop/ShopSealedBoxesPage.jsx'));
const ShopSinglesPage = lazy(() => import('@/pages/shop/ShopSinglesPage.jsx'));
const ShopCategoryPage = lazy(() => import('@/pages/shop/ShopCategoryPage.jsx'));
// Remounts ShopCategoryPage when the category slug changes so pagination/filters reset
const ShopCategoryRoute = () => { const { categorySlug } = useParams(); return <ShopCategoryPage key={categorySlug} />; };
const ShopBindersHubPage = lazy(() => import('@/pages/shop/ShopBindersHubPage.jsx'));
const ShopProductPage = lazy(() => import('@/pages/shop/ShopProductPage.jsx'));
const ShopBinderProductPage = lazy(() => import('@/pages/shop/ShopBinderProductPage.jsx'));
const ShopCollectionPage = lazy(() => import('@/pages/shop/ShopCollectionPage.jsx'));
// Remounts ShopCollectionPage when the group slug changes so filters/pagination reset
const ShopCollectionRoute = () => { const { groupSlug } = useParams(); return <ShopCollectionPage key={groupSlug} />; };

// Unified Product Details Route
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage.jsx'));

// Checkout
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage.jsx'));
const CheckoutSuccessPage = lazy(() => import('@/pages/CheckoutSuccessPage.jsx'));

// User Profiles & Settings
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage.jsx'));
const SecuritySettingsPage = lazy(() => import('@/pages/SecuritySettingsPage.jsx'));
const UserBalancePage = lazy(() => import('@/pages/UserBalancePage.jsx'));
const VerificationSubmissionPage = lazy(() => import('@/pages/VerificationSubmissionPage.jsx'));
const VerifyIdentityPage = lazy(() => import('@/pages/VerifyIdentityPage.jsx'));
const OnboardingCardPage = lazy(() => import('@/pages/OnboardingCardPage.jsx'));
const WelcomePage = lazy(() => import('@/pages/WelcomePage.jsx'));

// Public Profiles
const PublicSellerProfilePage = lazy(() => import('@/pages/PublicSellerProfilePage.jsx'));
const SellerProfilePage = lazy(() => import('@/pages/SellerProfilePage.jsx'));

// Account Dashboard Area
const AccountDashboard = lazy(() => import('@/pages/account/AccountDashboard.jsx'));
const AccountProfile = lazy(() => import('@/pages/account/AccountProfile.jsx'));
const AccountListings = lazy(() => import('@/pages/account/AccountListings.jsx'));
const AccountTransactions = lazy(() => import('@/pages/account/AccountTransactions.jsx'));
const AccountVault = lazy(() => import('@/pages/account/AccountVault.jsx'));
const AccountWallet = lazy(() => import('@/pages/account/AccountWallet.jsx'));
const AccountWatchlist = lazy(() => import('@/pages/account/AccountWatchlist.jsx'));
const AccountOffers = lazy(() => import('@/pages/account/AccountOffers.jsx'));
const AccountNotifications = lazy(() => import('@/pages/account/AccountNotifications.jsx'));
const AccountNotificationSettings = lazy(() => import('@/pages/account/AccountNotificationSettings.jsx'));
const AccountReviews = lazy(() => import('@/pages/account/AccountReviews.jsx'));
const AccountSecurity = lazy(() => import('@/pages/account/AccountSecurity.jsx'));
const AccountSellerTier = lazy(() => import('@/pages/account/AccountSellerTier.jsx'));
const AccountOrders = lazy(() => import('@/pages/account/AccountOrders.jsx'));
const AccountEvents = lazy(() => import('@/pages/account/AccountEvents.jsx'));
const AccountShows = lazy(() => import('@/pages/account/AccountShows.jsx'));
const AccountSoleTrader = lazy(() => import('@/pages/account/AccountSoleTrader.jsx'));
const AccountMembership = lazy(() => import('@/pages/account/AccountMembership.jsx'));
const SoleTraderStorePage = lazy(() => import('@/pages/SoleTraderStorePage.jsx'));

// Vault & Trading
const MyVaultPage = lazy(() => import('@/pages/MyVaultPage.jsx'));
const AddEditCardPage = lazy(() => import('@/pages/AddEditCardPage.jsx'));
const VaultProfilePage = lazy(() => import('@/pages/VaultProfilePage.jsx'));
// Forces AddEditCardPage to fully remount when switching between /vault/add and a
// specific /vault/edit/:id (or between two different ids), resetting the form so
// the previous card's data/images don't carry over.
const AddEditCardRoute = () => { const { id } = useParams(); return <AddEditCardPage key={id ?? 'new'} />; };
const TradeRequestsPage = lazy(() => import('@/pages/TradeRequestsPage.jsx'));
const MessagingPage = lazy(() => import('@/pages/MessagingPage.jsx'));
const TransactionHistoryPage = lazy(() => import('@/pages/TransactionHistoryPage.jsx'));

// Markets & Analytics
const MarketsPage = lazy(() => import('@/pages/markets/MarketsPage.jsx'));
const CardAnalyticsPage = lazy(() => import('@/pages/markets/CardAnalyticsPage.jsx'));
const MarketDetailPage = lazy(() => import('@/pages/markets/MarketDetailPage.jsx'));
const AustralianMarketsPage = lazy(() => import('@/pages/AustralianMarketsPage.jsx'));
const CardPricesHubPage = lazy(() => import('@/pages/prices/CardPricesHubPage.jsx'));
const CardPriceDetailPage = lazy(() => import('@/pages/prices/CardPriceDetailPage.jsx'));
const BuyingGuidesPage = lazy(() => import('@/pages/analytics/BuyingGuidesPage.jsx'));
const BuyingGuideDetailPage = lazy(() => import('@/pages/analytics/BuyingGuideDetailPage.jsx'));

// Partner program
const PartnersPage = lazy(() => import('@/pages/partners/PartnersPage.jsx'));
const PartnerApplyPage = lazy(() => import('@/pages/partners/PartnerApplyPage.jsx'));
const AccountPartner = lazy(() => import('@/pages/account/AccountPartner.jsx'));

// Store directory
const CardShopsHubPage = lazy(() => import('@/pages/stores/CardShopsHubPage.jsx'));
const CardShopsCityPage = lazy(() => import('@/pages/stores/CardShopsCityPage.jsx'));
const AddStorePage = lazy(() => import('@/pages/stores/AddStorePage.jsx'));

// Grading
const GradingPage = lazy(() => import('@/pages/grading/GradingPage.jsx'));
const GradingScalePage = lazy(() => import('@/pages/grading/GradingScalePage.jsx'));
const WhatIsGradingPage = lazy(() => import('@/pages/grading/WhatIsGradingPage.jsx'));
const GradingScalesPage = lazy(() => import('@/pages/grading/GradingScalesPage.jsx'));
const GradingCompaniesPage = lazy(() => import('@/pages/grading/GradingCompaniesPage.jsx'));
const LocalGradersPage = lazy(() => import('@/pages/grading/LocalGradersPage.jsx'));
const SubmissionPartnersPage = lazy(() => import('@/pages/grading/SubmissionPartnersPage.jsx'));
const GradeEstimatorPage = lazy(() => import('@/pages/grading/GradeEstimatorPage.jsx'));
const GradingROIPage = lazy(() => import('@/pages/grading/GradingROIPage.jsx'));

// Community & Blog
const BlogPage = lazy(() => import('@/pages/blog/BlogPage.jsx'));
const BlogArticlePage = lazy(() => import('@/pages/blog/BlogArticlePage.jsx'));
const BlogCategoryPage = lazy(() => import('@/pages/blog/BlogCategoryPage.jsx'));
const CommunityPage = lazy(() => import('@/pages/community/CommunityPage.jsx'));
const CommunityEventsPage = lazy(() => import('@/pages/community/CommunityEventsPage.jsx'));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage.jsx'));
const CommunityDiscussionPage = lazy(() => import('@/pages/community/CommunityDiscussionPage.jsx'));
const CommunityDiscussionNewPage = lazy(() => import('@/pages/community/CommunityDiscussionNewPage.jsx'));
const WhatnotShowsPage = lazy(() => import('@/pages/community/WhatnotShowsPage.jsx'));
const ForumPage = lazy(() => import('@/pages/community/ForumPage.jsx'));
const LeaderboardPage = lazy(() => import('@/pages/community/LeaderboardPage.jsx'));
const ProfilesPage = lazy(() => import('@/pages/community/ProfilesPage.jsx'));
const LocalTradersPage = lazy(() => import('@/pages/community/LocalTradersPage.jsx'));
const LocalMapPage = lazy(() => import('@/pages/community/LocalMapPage.jsx'));
const BuildingYourBusinessPage = lazy(() => import('@/pages/community/BuildingYourBusinessPage.jsx'));

// Admin Dashboard Area
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard.jsx'));
const ProductManagementPage = lazy(() => import('@/pages/admin/ProductManagementPage.jsx'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage.jsx'));
const UserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage.jsx'));
const SellersManagementPage = lazy(() => import('@/pages/admin/SellersManagementPage.jsx'));
const OrderManagementPage = lazy(() => import('@/pages/admin/OrderManagementPage.jsx'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage.jsx'));
const EventsAdminPage = lazy(() => import('@/pages/admin/EventsManagementPage.jsx'));
const WhatnotShowsAdminPage = lazy(() => import('@/pages/admin/WhatnotShowsAdminPage.jsx'));
const ContentManagementPage = lazy(() => import('@/pages/admin/ContentManagementPage.jsx'));
const SystemDiagnosticsPage = lazy(() => import('@/pages/admin/SystemDiagnosticsPage.jsx'));
const AnalyticsReportsPage = lazy(() => import('@/pages/admin/AnalyticsReportsPage.jsx'));
const RevenueBreakdownPage = lazy(() => import('@/pages/admin/RevenueBreakdownPage.jsx'));
const FinanceTaxPage = lazy(() => import('@/pages/admin/FinanceTaxPage.jsx'));
const MediaLibraryPage = lazy(() => import('@/pages/admin/MediaLibraryPage.jsx'));
const MarketplaceManagementPage = lazy(() => import('@/pages/admin/MarketplaceManagementPage.jsx'));
const CategoryMappingPage = lazy(() => import('@/pages/admin/CategoryMappingPage.jsx'));
const AdminVerificationDashboard = lazy(() => import('@/pages/admin/AdminVerificationDashboard.jsx'));
const ReportsModerationPage = lazy(() => import('@/pages/admin/ReportsModerationPage.jsx'));
const DisputesAdminPage = lazy(() => import('@/pages/admin/DisputesAdminPage.jsx'));
const OffersAdminPage = lazy(() => import('@/pages/admin/OffersAdminPage.jsx'));
const CommissionSettingsPage = lazy(() => import('@/pages/admin/CommissionSettingsPage.jsx'));
const CategoryManagementPage = lazy(() => import('@/pages/admin/CategoryManagementPage.jsx'));
const SubcategoryManagementPage = lazy(() => import('@/pages/admin/SubcategoryManagementPage.jsx'));
const BrandsManagementPage = lazy(() => import('@/pages/admin/BrandsManagementPage.jsx'));
const ProductLinesManagementPage = lazy(() => import('@/pages/admin/ProductLinesManagementPage.jsx'));
const CollectionsManagementPage = lazy(() => import('@/pages/admin/CollectionsManagementPage.jsx'));
const HeroShowcaseAdminPage = lazy(() => import('@/pages/admin/HeroShowcaseAdminPage.jsx'));
const CollectionSectionsAdminPage = lazy(() => import('@/pages/admin/CollectionSectionsAdminPage.jsx'));
const ChatModerationPage = lazy(() => import('@/pages/admin/ChatModerationPage.jsx'));
const StoreDirectoryAdminPage = lazy(() => import('@/pages/admin/StoreDirectoryAdminPage.jsx'));
const BusinessProfilesManagementPage = lazy(() => import('@/pages/admin/BusinessProfilesManagementPage.jsx'));
const PartnersManagementPage = lazy(() => import('@/pages/admin/PartnersManagementPage.jsx'));
const PromoCodesAdminPage = lazy(() => import('@/pages/admin/PromoCodesAdminPage.jsx'));
const BusinessAffiliateLinksAdminPage = lazy(() => import('@/pages/admin/BusinessAffiliateLinksAdminPage.jsx'));
const ShopAffiliateProductsAdminPage = lazy(() => import('@/pages/admin/ShopAffiliateProductsAdminPage.jsx'));
const CardArtManagementPage = lazy(() => import('@/pages/admin/CardArtManagementPage.jsx'));
const ListingsManagementPage = lazy(() => import('@/pages/ListingsManagementPage.jsx'));

// Previously-orphaned pages now wired up
const SalesHistoryPage = lazy(() => import('@/pages/SalesHistoryPage.jsx'));
const PublicCollectionsPage = lazy(() => import('@/pages/PublicCollectionsPage.jsx'));
const CardMarketDetailPage = lazy(() => import('@/pages/CardMarketDetailPage.jsx'));
const AddYourFirstCardPage = lazy(() => import('@/pages/AddYourFirstCardPage.jsx'));
const ScanPage = lazy(() => import('@/pages/ScanPage.jsx'));

// Info & Misc Pages
const SearchResultsPage = lazy(() => import('@/pages/SearchResultsPage.jsx'));
const DiagnosticsPage = lazy(() => import('@/pages/DiagnosticsPage.jsx'));
const InsiderTradingPage = lazy(() => import('@/pages/InsiderTradingPage.jsx'));
const SitemapPage = lazy(() => import('@/pages/SitemapPage.jsx'));

// Corporate Info Pages
const AboutPage = lazy(() => import('@/pages/info/AboutPage.jsx'));
const ContactPage = lazy(() => import('@/pages/info/ContactPage.jsx'));
const FAQPage = lazy(() => import('@/pages/info/FAQPage.jsx'));
const PricingPage = lazy(() => import('@/pages/PricingPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage.jsx'));
const ReturnsPage = lazy(() => import('@/pages/info/ReturnsPage.jsx'));
const ShippingPage = lazy(() => import('@/pages/info/ShippingPage.jsx'));
const TermsPage = lazy(() => import('@/pages/info/TermsPage.jsx'));
const TrustSafetyPage = lazy(() => import('@/pages/info/TrustSafetyPage.jsx'));
const SafeBuyingPage = lazy(() => import('@/pages/info/SafeBuyingPage.jsx'));
const AccessibilityPage = lazy(() => import('@/pages/info/AccessibilityPage.jsx'));
const DataDeletionPage = lazy(() => import('@/pages/info/DataDeletionPage.jsx'));
const PhotographyStandardPage = lazy(() => import('@/pages/info/PhotographyStandardPage.jsx'));
const ConvictionRatingPage = lazy(() => import('@/pages/info/ConvictionRatingPage.jsx'));

const App = () => {
  return (
    <ErrorBoundary>
      <HelmetProvider>
      <PlatformSettingsProvider>
      <AuthProvider>
        <AdminProvider>
          <CartProvider>
            <CategoryHierarchyProvider>
            <WatchlistProvider>
              <Router>
                <ScrollToTop />
                <AnalyticsPageViews />
                <AdsenseRouteLoader />
                <GoogleReviewsBadgeLoader />
                <ReferralCapture />
                <div className="flex flex-col min-h-screen bg-background text-foreground">
                  <Helmet>
                    <title>CardPop | Australia's Trading Card Marketplace</title>
                    <meta name="description" content="Buy, sell, and trade Pokémon, Magic: The Gathering, sports cards and more on CardPop — Australia's most trusted trading card platform." />
                  </Helmet>
                  
                  <Header />
                  
                  <main className="flex-grow flex flex-col">
                    <RouteErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <MaintenanceGate>
                      <Routes>
                        {/* --- PUBLIC ROUTES --- */}
                        <Route path="/" element={COMING_SOON ? <Navigate to="/launch" replace /> : <Suspense fallback={<HeroSection />}><HomePage /></Suspense>} />
                        <Route path="/launch" element={COMING_SOON ? <Suspense fallback={<LaunchHero />}><LaunchPage /></Suspense> : <LaunchPage />} />

                        {/* Auth */}
                        <Route path="/logout" element={<LogoutPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        {/* Public: receives the Supabase email-confirmation link,
                            then routes into the ID-verification onboarding chain. */}
                        <Route path="/welcome" element={<WelcomePage />} />
                        <Route path="/reset-password" element={<PasswordResetPage />} />
                        <Route path="/forgot-password" element={<PasswordResetPage />} />
                        <Route path="/verification-pending" element={<VerificationPendingPage />} />
                        <Route path="/complete-profile/:token" element={<ProfileCompletionPage />} />
                        
                        {/* Collections */}
                        <Route path="/collections" element={<PublicCollectionsPage />} />
                        <Route path="/collections/:collectionSlug" element={<CollectionRoute />} />

                        {/* Marketplace — gated by the enable_marketplace platform flag */}
                        <Route path="/marketplace" element={<FeatureRoute flag="enable_marketplace"><MarketplacePage /></FeatureRoute>} />
                        {/* Orphaned category route (no inbound links, MarketplacePage doesn't read the param) — redirect to the base marketplace */}
                        <Route path="/marketplace/category/:category" element={<Navigate to="/marketplace" replace />} />
                        {/* Canonical marketplace listing URL — the sitemap, bot prerenderer and
                            most internal links all use /marketplace/:id/:slug, so the listing page
                            renders here directly (no client redirect that would create a duplicate
                            URL for Google to index). */}
                        <Route path="/marketplace/:id/:slug?" element={<FeatureRoute flag="enable_marketplace"><ProductDetailPage source="marketplace" /></FeatureRoute>} />
                        {/* /browse was retired in favour of /marketplace — redirect any bookmarked or indexed links */}
                        <Route path="/browse" element={<Navigate to="/marketplace" replace />} />

                        {/* Public Profile Routes */}
                        <Route path="/seller/:userId" element={<PublicSellerProfilePage />} />
                        <Route path="/dealer/:userId" element={<SoleTraderStorePage />} />

                        {/* Legacy alias — /product/marketplace/... redirects to the canonical
                            /marketplace/:id/:slug (server-side 301 in vercel.json covers full loads;
                            this covers in-app navigations from stale links). */}
                        <Route path="/product/marketplace/:id/:slug?" element={<MarketplaceListingRedirect />} />
                        {/* Unified Product Route — optional slug is cosmetic, id is used for fetching */}
                        <Route path="/product/:source/:id/:slug?" element={<ProductDetailPage />} />
                        
                        {/* Shop */}
                        <Route path="/shop" element={<ShopPage />} />
                        <Route path="/shop/sealed-boxes" element={<ShopSealedBoxesPage />} />
                        <Route path="/shop/singles" element={<ShopSinglesPage />} />
                        <Route path="/shop/category/:categorySlug" element={<ShopCategoryRoute />} />
                        {/* Binder brand hub + one page per Palms Off Gaming binder. Both are
                            static-prefixed so they out-rank the /shop/:groupSlug route below. */}
                        <Route path="/shop/binders" element={<ShopBindersHubPage />} />
                        <Route path="/shop/binders/:productSlug" element={<ShopBinderProductPage />} />
                        {/* Individual product pages inside the normal product-type
                            taxonomy: /shop/<type>/<product>. Two segments, so this
                            never collides with the single-segment /shop/:groupSlug
                            below, and /shop/category/<slug> out-ranks it on the
                            static first segment. */}
                        <Route path="/shop/:categorySlug/:productSlug" element={<ShopProductPage />} />
                        {/* Supply collection pages (Protection, Storage, Display, Shipping, Grading).
                            Static /shop/* routes above out-rank this single-segment dynamic route. */}
                        <Route path="/shop/:groupSlug" element={<ShopCollectionRoute />} />

                        {/* Checkout */}
                        {/* Guest checkout: anyone can buy from the shop / marketplace.
                            Account creation is offered after payment on the success page. */}
                        <Route path="/checkout/:cardId?" element={<CheckoutPage />} />
                        <Route path="/checkout-success" element={<CheckoutSuccessPage />} />
                        <Route path="/success" element={<CheckoutSuccessPage />} />
                        
                        {/* User Profiles & Settings */}
                        <Route path="/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                        <Route path="/verify-account" element={<ProtectedRoute><VerificationSubmissionPage /></ProtectedRoute>} />
                        <Route path="/verify-identity" element={<ProtectedRoute><VerifyIdentityPage /></ProtectedRoute>} />
                        <Route path="/onboarding/card" element={<ProtectedRoute><OnboardingCardPage /></ProtectedRoute>} />
                        <Route path="/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />
                        <Route path="/balance" element={<ProtectedRoute><UserBalancePage /></ProtectedRoute>} />
                        
                        {/* Account Dashboard Area */}
                        <Route path="/account" element={<ProtectedRoute><AccountDashboard /></ProtectedRoute>} />
                        <Route path="/account/profile" element={<ProtectedRoute><AccountProfile /></ProtectedRoute>} />
                        <Route path="/account/listings" element={<ProtectedRoute><AccountListings /></ProtectedRoute>} />
                        <Route path="/account/transactions" element={<ProtectedRoute><AccountTransactions /></ProtectedRoute>} />
                        <Route path="/account/vault" element={<ProtectedRoute><AccountVault /></ProtectedRoute>} />
                        <Route path="/account/wallet" element={<ProtectedRoute><AccountWallet /></ProtectedRoute>} />
                        <Route path="/account/watchlist" element={<ProtectedRoute><AccountWatchlist /></ProtectedRoute>} />
                        <Route path="/account/offers" element={<ProtectedRoute><AccountOffers /></ProtectedRoute>} />
                        <Route path="/account/notifications" element={<ProtectedRoute><AccountNotifications /></ProtectedRoute>} />
                        <Route path="/account/notification-settings" element={<ProtectedRoute><AccountNotificationSettings /></ProtectedRoute>} />
                        <Route path="/account/reviews" element={<ProtectedRoute><AccountReviews /></ProtectedRoute>} />
                        <Route path="/account/security" element={<ProtectedRoute><AccountSecurity /></ProtectedRoute>} />
                        {/* Identity verification is handled entirely by Stripe Identity now —
                            the old manual document-upload page is gone; keep the URL working. */}
                        <Route path="/account/verification" element={<Navigate to="/verify-identity" replace />} />
                        <Route path="/account/seller-tier" element={<ProtectedRoute><AccountSellerTier /></ProtectedRoute>} />
                        <Route path="/account/orders" element={<ProtectedRoute><AccountOrders /></ProtectedRoute>} />
                        <Route path="/account/events" element={<ProtectedRoute><AccountEvents /></ProtectedRoute>} />
                        <Route path="/account/shows" element={<ProtectedRoute><AccountShows /></ProtectedRoute>} />
                        <Route path="/account/sole-trader" element={<ProtectedRoute><AccountSoleTrader /></ProtectedRoute>} />
                        <Route path="/account/membership" element={<ProtectedRoute><AccountMembership /></ProtectedRoute>} />
                        <Route path="/account/partner" element={<ProtectedRoute><AccountPartner /></ProtectedRoute>} />
                        
                        {/* Vault & Trading */}
                        <Route path="/vault" element={<ProtectedRoute><MyVaultPage /></ProtectedRoute>} />
                        <Route path="/my-vault" element={<ProtectedRoute><MyVaultPage /></ProtectedRoute>} />
                        <Route path="/vault/welcome" element={<AddYourFirstCardPage />} />
                        <Route path="/vault/profile" element={<ProtectedRoute><VaultProfilePage /></ProtectedRoute>} />
                        <Route path="/vault/add" element={<ProtectedRoute><AddEditCardRoute /></ProtectedRoute>} />
                        <Route path="/vault/edit/:id" element={<ProtectedRoute><AddEditCardRoute /></ProtectedRoute>} />
                        <Route path="/trade-requests" element={<FeatureRoute flag="enable_trading"><ProtectedRoute><TradeRequestsPage /></ProtectedRoute></FeatureRoute>} />
                        <Route path="/messaging" element={<ProtectedRoute><MessagingPage /></ProtectedRoute>} />
                        <Route path="/transactions" element={<ProtectedRoute><TransactionHistoryPage /></ProtectedRoute>} />
                        <Route path="/sales-history" element={<SalesHistoryPage />} />

                        {/* Card scanner — public price checker */}
                        <Route path="/scan" element={<ScanPage />} />

                        {/* Markets & Analytics */}
                        <Route path="/analytics" element={<MarketsPage />} />
                        {/* Buying Guides — new-release + chase-card editorial. Declared
                            before the dynamic /analytics/:category routes below; the
                            static "buying-guides" segment out-ranks the param match. */}
                        <Route path="/analytics/buying-guides" element={<BuyingGuidesPage />} />
                        <Route path="/analytics/buying-guides/:slug" element={<BuyingGuideDetailPage />} />
                        {/* SEO-friendly slug path (canonical); the bare query-param
                            form is kept for back-compat and self-redirects to the slug. */}
                        <Route path="/analytics/card/:slug" element={<CardAnalyticsPage />} />
                        <Route path="/analytics/card" element={<CardAnalyticsPage />} />
                        {/* Orphaned category route (no inbound links, MarketsPage has no category filter) — redirect to the base analytics page */}
                        <Route path="/analytics/:category" element={<Navigate to="/analytics" replace />} />
                        <Route path="/analytics/:category/:market" element={<MarketDetailPage />} />
                        <Route path="/markets" element={<Navigate to="/analytics" replace />} />
                        <Route path="/markets/*" element={<Navigate to="/analytics" replace />} />
                        <Route path="/australian-markets" element={<AustralianMarketsPage />} />

                        {/* Public card price pages (SEO) */}
                        <Route path="/prices" element={<CardPricesHubPage />} />
                        <Route path="/prices/:category" element={<CardPricesHubPage />} />
                        <Route path="/prices/:category/:slug" element={<CardPriceDetailPage />} />

                        {/* Partner program */}
                        <Route path="/partners" element={<PartnersPage />} />
                        <Route path="/partners/apply" element={<ProtectedRoute><PartnerApplyPage /></ProtectedRoute>} />

                        {/* Store directory (SEO) */}
                        <Route path="/card-shops" element={<CardShopsHubPage />} />
                        <Route path="/card-shops/add" element={<AddStorePage />} />
                        <Route path="/card-shops/:city" element={<CardShopsCityPage />} />
                        <Route path="/card-market/:cardId" element={<CardMarketDetailPage />} />
                        {/* Legacy route: the old CategoryPage queried a listings.category
                            column that doesn't exist, so it always rendered empty — the
                            marketplace's category filters are the real browse surface. */}
                        <Route path="/category/:categoryId" element={<Navigate to="/marketplace" replace />} />
                        
                        {/* Grading */}
                        <Route path="/grading" element={<GradingPage />} />
                        <Route path="/grading/what-is-grading" element={<WhatIsGradingPage />} />
                        <Route path="/grading/scales" element={<GradingScalesPage />} />
                        <Route path="/grading/scales/:scale" element={<GradingScalePage />} />
                        <Route path="/grading/companies" element={<GradingCompaniesPage />} />
                        <Route path="/grading/local" element={<Navigate to="/grading/submission-partners" replace />} />
                        <Route path="/grading/local-graders" element={<LocalGradersPage />} />
                        <Route path="/grading/submission-partners" element={<SubmissionPartnersPage />} />
                        <Route path="/grading/guide/:scale" element={<GradingScalePage />} />
                        <Route path="/grading/estimator" element={<GradeEstimatorPage />} />
                        <Route path="/grading/roi-calculator" element={<GradingROIPage />} />
                        
                        {/* Community & Blog — blog gated by the enable_blog platform flag */}
                        <Route path="/blog" element={<FeatureRoute flag="enable_blog"><BlogPage /></FeatureRoute>} />
                        <Route path="/blog/category/:category" element={<FeatureRoute flag="enable_blog"><BlogCategoryPage /></FeatureRoute>} />
                        <Route path="/blog/slug/:slug" element={<FeatureRoute flag="enable_blog"><BlogArticlePage /></FeatureRoute>} />
                        <Route path="/blog/:id" element={<FeatureRoute flag="enable_blog"><BlogArticlePage /></FeatureRoute>} />
                        <Route path="/community" element={<CommunityPage />} />
                        <Route path="/community/forum" element={<ForumPage />} />
                        <Route path="/community/leaderboard" element={<LeaderboardPage />} />
                        <Route path="/community/profiles" element={<ProfilesPage />} />
                        <Route path="/community/retailers" element={<Navigate to="/card-shops" replace />} />
                        <Route path="/community/local-traders" element={<LocalTradersPage />} />
                        <Route path="/community/map" element={<LocalMapPage />} />
                        <Route path="/events" element={<CommunityEventsPage />} />
                        <Route path="/events/card-shows" element={<CommunityEventsPage defaultType="card_show" />} />
                        <Route path="/events/trade-events" element={<CommunityEventsPage defaultType="trade_event" />} />
                        <Route path="/events/community-events" element={<CommunityEventsPage defaultType="community_event" />} />
                        <Route path="/events/store-events" element={<CommunityEventsPage defaultType="lgs_event" />} />
                        <Route path="/events/:eventId" element={<EventDetailPage />} />
                        <Route path="/community/events" element={<Navigate to="/events" replace />} />
                        <Route path="/community/events/:eventId" element={<RedirectEventDetail />} />
                        <Route path="/community/discussion/new" element={<ProtectedRoute><CommunityDiscussionNewPage /></ProtectedRoute>} />
                        <Route path="/community/discussion/:id" element={<CommunityDiscussionPage />} />
                        <Route path="/community/whatnot" element={<WhatnotShowsPage />} />
                        <Route path="/community/building-your-business" element={<BuildingYourBusinessPage />} />
                        <Route path="/community/user/:sellerId" element={<SellerProfilePage />} />
                        
                        {/* Search & Misc */}
                        <Route path="/search" element={<SearchResultsPage />} />
                        <Route path="/diagnostics" element={<DiagnosticsPage />} />
                        <Route path="/insider-trading" element={<InsiderTradingPage />} />
                        <Route path="/sitemap" element={<SitemapPage />} />
                        
                        {/* Info Pages */}
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/pricing" element={<PricingPage />} />
                        <Route path="/contact" element={<ContactPage />} />
                        <Route path="/faq" element={<FAQPage />} />
                        <Route path="/privacy" element={<PrivacyPolicyPage />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                        <Route path="/returns" element={<ReturnsPage />} />
                        <Route path="/shipping" element={<ShippingPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/trust-safety" element={<TrustSafetyPage />} />
                        <Route path="/safe-buying" element={<SafeBuyingPage />} />
                        <Route path="/accessibility" element={<AccessibilityPage />} />
                        <Route path="/data-deletion" element={<DataDeletionPage />} />
                        <Route path="/photography-standard" element={<PhotographyStandardPage />} />
                        <Route path="/photography-guide" element={<PhotographyStandardPage />} />
                        <Route path="/conviction-rating" element={<ConvictionRatingPage />} />
                        
                        {/* --- PROTECTED ADMIN ROUTES (NESTED UNDER ADMINLAYOUT) --- */}
                        <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
                          <Route index element={<AdminDashboard />} />
                          <Route path="events" element={<EventsAdminPage />} />
                          <Route path="whatnot-shows" element={<WhatnotShowsAdminPage />} />
                          <Route path="products" element={<ProductManagementPage />} />
                          <Route path="users" element={<UserManagementPage />} />
                          <Route path="users/:userId" element={<UserDetailPage />} />
                          <Route path="sellers" element={<SellersManagementPage />} />
                          <Route path="orders" element={<OrderManagementPage />} />
                          <Route path="categories" element={<CategoryManagementPage />} />
                          <Route path="brands" element={<BrandsManagementPage />} />
                          <Route path="settings" element={<AdminSettingsPage />} />
                          <Route path="subcategories" element={<SubcategoryManagementPage />} />
                          <Route path="events-calendar" element={<EventsAdminPage />} />
                          <Route path="content" element={<ContentManagementPage />} />
                          <Route path="diagnostics" element={<SystemDiagnosticsPage />} />
                          <Route path="analytics" element={<AnalyticsReportsPage />} />
                          <Route path="analytics-reports" element={<AnalyticsReportsPage />} />
                          <Route path="revenue" element={<RevenueBreakdownPage />} />
                          <Route path="finance" element={<FinanceTaxPage />} />
                          <Route path="media" element={<MediaLibraryPage />} />
                          <Route path="marketplace" element={<MarketplaceManagementPage />} />
                          <Route path="category-mapping" element={<CategoryMappingPage />} />
                          <Route path="verification" element={<AdminVerificationDashboard />} />
                          <Route path="reports" element={<ReportsModerationPage />} />
                          <Route path="disputes" element={<DisputesAdminPage />} />
                          <Route path="offers" element={<OffersAdminPage />} />
                          <Route path="commissions" element={<CommissionSettingsPage />} />
                          <Route path="product-lines" element={<ProductLinesManagementPage />} />
                          <Route path="collections" element={<CollectionsManagementPage />} />
                          <Route path="hero-showcase" element={<HeroShowcaseAdminPage />} />
                          <Route path="collection-sections" element={<CollectionSectionsAdminPage />} />
                          <Route path="all-listings" element={<ListingsManagementPage />} />
                          <Route path="messages" element={<ChatModerationPage />} />
                          <Route path="store-directory" element={<StoreDirectoryAdminPage />} />
                          <Route path="business-profiles" element={<BusinessProfilesManagementPage />} />
                          <Route path="partners" element={<PartnersManagementPage />} />
                          <Route path="promo-codes" element={<PromoCodesAdminPage />} />
                          <Route path="building-your-business" element={<BusinessAffiliateLinksAdminPage />} />
                          <Route path="shop-affiliate-products" element={<ShopAffiliateProductsAdminPage />} />
                          <Route path="card-art" element={<CardArtManagementPage />} />
                        </Route>
                        
                        {/* --- CATCH-ALL 404 ROUTE --- */}
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                      </MaintenanceGate>
                    </Suspense>
                    </RouteErrorBoundary>
                  </main>
                  
                  <Suspense fallback={null}>
                    <Footer />
                  </Suspense>
                  <ShoppingCart />
                  <Toaster position="bottom-right" richColors closeButton />
                </div>
              </Router>
            </WatchlistProvider>
            </CategoryHierarchyProvider>
          </CartProvider>
        </AdminProvider>
      </AuthProvider>
      </PlatformSettingsProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default App;
