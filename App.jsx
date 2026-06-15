
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/sonner';

// Contexts
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import { AdminProvider } from '@/contexts/AdminContext.jsx';
import { CartProvider } from '@/hooks/useCart.jsx';
import { CategoryHierarchyProvider } from '@/contexts/CategoryContext.jsx';

// Layouts & Core Components
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import ProtectedAdminRoute from '@/components/ProtectedAdminRoute.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import PageLoader from '@/components/PageLoader.jsx';
import ShoppingCart from '@/components/ShoppingCart.jsx';
import AdminLayout from '@/components/AdminLayout.jsx';

// ==========================================
// LAZY LOADED PAGES (Performance Optimized)
// ==========================================

// Core & Auth
const HomePage = lazy(() => import('@/pages/HomePage.jsx'));
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

// Resets the error boundary on every route change so a page error doesn't persist to other pages
const RouteErrorBoundary = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

// Marketplace
const MarketplacePage = lazy(() => import('@/pages/marketplace/MarketplacePage.jsx'));
const MarketplaceCategoryPage = lazy(() => import('@/pages/marketplace/MarketplaceCategoryPage.jsx'));
const BrowseListingsPage = lazy(() => import('@/pages/BrowseListingsPage.jsx'));

// Shop
const ShopPage = lazy(() => import('@/pages/shop/ShopPage.jsx'));
const ShopSealedBoxesPage = lazy(() => import('@/pages/shop/ShopSealedBoxesPage.jsx'));
const ShopSinglesPage = lazy(() => import('@/pages/shop/ShopSinglesPage.jsx'));
const ShopCategoryPage = lazy(() => import('@/pages/shop/ShopCategoryPage.jsx'));

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
const AccountVerification = lazy(() => import('@/pages/account/AccountVerification.jsx'));
const AccountSellerTier = lazy(() => import('@/pages/account/AccountSellerTier.jsx'));
const AccountOrders = lazy(() => import('@/pages/account/AccountOrders.jsx'));
const AccountEvents = lazy(() => import('@/pages/account/AccountEvents.jsx'));

// Vault & Trading
const MyVaultPage = lazy(() => import('@/pages/MyVaultPage.jsx'));
const AddEditCardPage = lazy(() => import('@/pages/AddEditCardPage.jsx'));
const VaultProfilePage = lazy(() => import('@/pages/VaultProfilePage.jsx'));
const TradeRequestsPage = lazy(() => import('@/pages/TradeRequestsPage.jsx'));
const MessagingPage = lazy(() => import('@/pages/MessagingPage.jsx'));
const TransactionHistoryPage = lazy(() => import('@/pages/TransactionHistoryPage.jsx'));

// Markets & Analytics
const MarketsPage = lazy(() => import('@/pages/markets/MarketsPage.jsx'));
const CardAnalyticsPage = lazy(() => import('@/pages/markets/CardAnalyticsPage.jsx'));
const MarketDetailPage = lazy(() => import('@/pages/markets/MarketDetailPage.jsx'));
const MarketCategoryPage = lazy(() => import('@/pages/markets/MarketCategoryPage.jsx'));
const AustralianMarketsPage = lazy(() => import('@/pages/AustralianMarketsPage.jsx'));

// Grading
const GradingPage = lazy(() => import('@/pages/grading/GradingPage.jsx'));
const GradingScalePage = lazy(() => import('@/pages/grading/GradingScalePage.jsx'));
const WhatIsGradingPage = lazy(() => import('@/pages/grading/WhatIsGradingPage.jsx'));
const GradingScalesPage = lazy(() => import('@/pages/grading/GradingScalesPage.jsx'));
const GradingCompaniesPage = lazy(() => import('@/pages/grading/GradingCompaniesPage.jsx'));
const LocalGradersPage = lazy(() => import('@/pages/grading/LocalGradersPage.jsx'));

// Community & Blog
const BlogPage = lazy(() => import('@/pages/blog/BlogPage.jsx'));
const BlogArticlePage = lazy(() => import('@/pages/blog/BlogArticlePage.jsx'));
const BlogCategoryPage = lazy(() => import('@/pages/blog/BlogCategoryPage.jsx'));
const CommunityPage = lazy(() => import('@/pages/community/CommunityPage.jsx'));
const CommunityEventsPage = lazy(() => import('@/pages/community/CommunityEventsPage.jsx'));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage.jsx'));
const CommunityDiscussionPage = lazy(() => import('@/pages/community/CommunityDiscussionPage.jsx'));
const WhatnotShowsPage = lazy(() => import('@/pages/community/WhatnotShowsPage.jsx'));
const ForumPage = lazy(() => import('@/pages/community/ForumPage.jsx'));
const ProfilesPage = lazy(() => import('@/pages/community/ProfilesPage.jsx'));
const RetailersPage = lazy(() => import('@/pages/community/RetailersPage.jsx'));
const LocalTradersPage = lazy(() => import('@/pages/community/LocalTradersPage.jsx'));

// Admin Dashboard Area
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard.jsx'));
const ProductManagementPage = lazy(() => import('@/pages/admin/ProductManagementPage.jsx'));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage.jsx'));
const UserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage.jsx'));
const OrderManagementPage = lazy(() => import('@/pages/admin/OrderManagementPage.jsx'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage.jsx'));
const EventsAdminPage = lazy(() => import('@/pages/admin/EventsManagementPage.jsx'));
const ContentManagementPage = lazy(() => import('@/pages/admin/ContentManagementPage.jsx'));
const SystemDiagnosticsPage = lazy(() => import('@/pages/admin/SystemDiagnosticsPage.jsx'));
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage.jsx'));
const AnalyticsReportsPage = lazy(() => import('@/pages/admin/AnalyticsReportsPage.jsx'));
const MediaLibraryPage = lazy(() => import('@/pages/admin/MediaLibraryPage.jsx'));
const MarketplaceManagementPage = lazy(() => import('@/pages/admin/MarketplaceManagementPage.jsx'));
const CategoryMappingPage = lazy(() => import('@/pages/admin/CategoryMappingPage.jsx'));
const AdminVerificationDashboard = lazy(() => import('@/pages/admin/AdminVerificationDashboard.jsx'));
const CommissionSettingsPage = lazy(() => import('@/pages/admin/CommissionSettingsPage.jsx'));
const CategoryManagementPage = lazy(() => import('@/pages/admin/CategoryManagementPage.jsx'));
const SubcategoryManagementPage = lazy(() => import('@/pages/admin/SubcategoryManagementPage.jsx'));
const BrandsManagementPage = lazy(() => import('@/pages/admin/BrandsManagementPage.jsx'));
const ProductLinesManagementPage = lazy(() => import('@/pages/admin/ProductLinesManagementPage.jsx'));
const CollectionsManagementPage = lazy(() => import('@/pages/admin/CollectionsManagementPage.jsx'));
const FeaturedCardsAdminPage = lazy(() => import('@/pages/FeaturedCardsAdminPage.jsx'));
const ListingsManagementPage = lazy(() => import('@/pages/ListingsManagementPage.jsx'));

// Previously-orphaned pages now wired up
const SalesHistoryPage = lazy(() => import('@/pages/SalesHistoryPage.jsx'));
const CategoryPage = lazy(() => import('@/pages/CategoryPage.jsx'));
const PublicCollectionsPage = lazy(() => import('@/pages/PublicCollectionsPage.jsx'));
const CardMarketDetailPage = lazy(() => import('@/pages/CardMarketDetailPage.jsx'));
const AddYourFirstCardPage = lazy(() => import('@/pages/AddYourFirstCardPage.jsx'));

// Info & Misc Pages
const SearchResultsPage = lazy(() => import('@/pages/SearchResultsPage.jsx'));
const DiagnosticsPage = lazy(() => import('@/pages/DiagnosticsPage.jsx'));
const InsiderTradingPage = lazy(() => import('@/pages/InsiderTradingPage.jsx'));
const SitemapPage = lazy(() => import('@/pages/SitemapPage.jsx'));

// Corporate Info Pages
const AboutPage = lazy(() => import('@/pages/info/AboutPage.jsx'));
const ContactPage = lazy(() => import('@/pages/info/ContactPage.jsx'));
const FAQPage = lazy(() => import('@/pages/info/FAQPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage.jsx'));
const ReturnsPage = lazy(() => import('@/pages/info/ReturnsPage.jsx'));
const ShippingPage = lazy(() => import('@/pages/info/ShippingPage.jsx'));
const TermsPage = lazy(() => import('@/pages/info/TermsPage.jsx'));
const TrustSafetyPage = lazy(() => import('@/pages/info/TrustSafetyPage.jsx'));
const AccessibilityPage = lazy(() => import('@/pages/info/AccessibilityPage.jsx'));
const PhotographyStandardPage = lazy(() => import('@/pages/info/PhotographyStandardPage.jsx'));

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminProvider>
          <CartProvider>
            <CategoryHierarchyProvider>
              <Router>
                <ScrollToTop />
                <div className="flex flex-col min-h-screen bg-background text-foreground">
                  <Helmet>
                    <title>CardPop | Australia's Trading Card Marketplace</title>
                    <meta name="description" content="Buy, sell, and trade Pokémon, Magic: The Gathering, sports cards and more on CardPop — Australia's most trusted trading card platform." />
                  </Helmet>
                  
                  <Header />
                  
                  <main className="flex-grow flex flex-col">
                    <RouteErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* --- PUBLIC ROUTES --- */}
                        <Route path="/" element={<HomePage />} />
                        
                        {/* Auth */}
                        <Route path="/logout" element={<LogoutPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/reset-password" element={<PasswordResetPage />} />
                        <Route path="/forgot-password" element={<PasswordResetPage />} />
                        <Route path="/verification-pending" element={<VerificationPendingPage />} />
                        <Route path="/complete-profile/:token" element={<ProfileCompletionPage />} />
                        
                        {/* Collections */}
                        <Route path="/collections" element={<PublicCollectionsPage />} />
                        <Route path="/collections/:collectionSlug" element={<CollectionRoute />} />

                        {/* Marketplace */}
                        <Route path="/marketplace" element={<MarketplacePage />} />
                        <Route path="/marketplace/category/:category" element={<MarketplaceCategoryPage />} />
                        <Route path="/browse" element={<BrowseListingsPage />} />
                        
                        {/* Public Profile Routes */}
                        <Route path="/seller/:userId" element={<PublicSellerProfilePage />} />
                        
                        {/* Unified Product Route — optional slug is cosmetic, id is used for fetching */}
                        <Route path="/product/:source/:id/:slug?" element={<ProductDetailPage />} />
                        
                        {/* Shop */}
                        <Route path="/shop" element={<ShopPage />} />
                        <Route path="/shop/sealed-boxes" element={<ShopSealedBoxesPage />} />
                        <Route path="/shop/singles" element={<ShopSinglesPage />} />
                        <Route path="/shop/category/:categorySlug" element={<ShopCategoryPage />} />
                        
                        {/* Checkout */}
                        <Route path="/checkout/:cardId?" element={<CheckoutPage />} />
                        <Route path="/checkout-success" element={<CheckoutSuccessPage />} />
                        <Route path="/success" element={<CheckoutSuccessPage />} />
                        
                        {/* User Profiles & Settings */}
                        <Route path="/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                        <Route path="/verify-account" element={<ProtectedRoute><VerificationSubmissionPage /></ProtectedRoute>} />
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
                        <Route path="/account/verification" element={<ProtectedRoute><AccountVerification /></ProtectedRoute>} />
                        <Route path="/account/seller-tier" element={<ProtectedRoute><AccountSellerTier /></ProtectedRoute>} />
                        <Route path="/account/orders" element={<ProtectedRoute><AccountOrders /></ProtectedRoute>} />
                        <Route path="/account/events" element={<ProtectedRoute><AccountEvents /></ProtectedRoute>} />
                        
                        {/* Vault & Trading */}
                        <Route path="/vault" element={<ProtectedRoute><MyVaultPage /></ProtectedRoute>} />
                        <Route path="/my-vault" element={<ProtectedRoute><MyVaultPage /></ProtectedRoute>} />
                        <Route path="/vault/welcome" element={<AddYourFirstCardPage />} />
                        <Route path="/vault/profile" element={<ProtectedRoute><VaultProfilePage /></ProtectedRoute>} />
                        <Route path="/vault/add" element={<ProtectedRoute><AddEditCardPage /></ProtectedRoute>} />
                        <Route path="/vault/edit/:id" element={<ProtectedRoute><AddEditCardPage /></ProtectedRoute>} />
                        <Route path="/trade-requests" element={<ProtectedRoute><TradeRequestsPage /></ProtectedRoute>} />
                        <Route path="/messaging" element={<ProtectedRoute><MessagingPage /></ProtectedRoute>} />
                        <Route path="/transactions" element={<ProtectedRoute><TransactionHistoryPage /></ProtectedRoute>} />
                        <Route path="/sales-history" element={<SalesHistoryPage />} />

                        {/* Markets & Analytics */}
                        <Route path="/analytics" element={<MarketsPage />} />
                        <Route path="/analytics/card" element={<CardAnalyticsPage />} />
                        <Route path="/analytics/:category" element={<MarketCategoryPage />} />
                        <Route path="/analytics/:category/:market" element={<MarketDetailPage />} />
                        <Route path="/markets" element={<Navigate to="/analytics" replace />} />
                        <Route path="/markets/*" element={<Navigate to="/analytics" replace />} />
                        <Route path="/australian-markets" element={<AustralianMarketsPage />} />
                        <Route path="/card-market/:cardId" element={<CardMarketDetailPage />} />
                        <Route path="/category/:categoryId" element={<CategoryPage />} />
                        
                        {/* Grading */}
                        <Route path="/grading" element={<GradingPage />} />
                        <Route path="/grading/what-is-grading" element={<WhatIsGradingPage />} />
                        <Route path="/grading/scales" element={<GradingScalesPage />} />
                        <Route path="/grading/scales/:scale" element={<GradingScalePage />} />
                        <Route path="/grading/companies" element={<GradingCompaniesPage />} />
                        <Route path="/grading/local" element={<LocalGradersPage />} />
                        <Route path="/grading/guide/:scale" element={<GradingScalePage />} />
                        
                        {/* Community & Blog */}
                        <Route path="/blog" element={<BlogPage />} />
                        <Route path="/blog/category/:category" element={<BlogCategoryPage />} />
                        <Route path="/blog/slug/:slug" element={<BlogArticlePage />} />
                        <Route path="/blog/:id" element={<BlogArticlePage />} />
                        <Route path="/community" element={<CommunityPage />} />
                        <Route path="/community/forum" element={<ForumPage />} />
                        <Route path="/community/profiles" element={<ProfilesPage />} />
                        <Route path="/community/retailers" element={<RetailersPage />} />
                        <Route path="/community/local-traders" element={<LocalTradersPage />} />
                        <Route path="/events" element={<CommunityEventsPage />} />
                        <Route path="/events/card-shows" element={<CommunityEventsPage defaultType="card_show" />} />
                        <Route path="/events/trade-events" element={<CommunityEventsPage defaultType="trade_event" />} />
                        <Route path="/events/community-events" element={<CommunityEventsPage defaultType="community_event" />} />
                        <Route path="/events/store-events" element={<CommunityEventsPage defaultType="lgs_event" />} />
                        <Route path="/events/:eventId" element={<EventDetailPage />} />
                        <Route path="/community/events" element={<Navigate to="/events" replace />} />
                        <Route path="/community/events/:eventId" element={<RedirectEventDetail />} />
                        <Route path="/community/discussion/:id" element={<CommunityDiscussionPage />} />
                        <Route path="/community/whatnot" element={<WhatnotShowsPage />} />
                        <Route path="/community/user/:sellerId" element={<SellerProfilePage />} />
                        
                        {/* Search & Misc */}
                        <Route path="/search" element={<SearchResultsPage />} />
                        <Route path="/diagnostics" element={<DiagnosticsPage />} />
                        <Route path="/insider-trading" element={<InsiderTradingPage />} />
                        <Route path="/sitemap" element={<SitemapPage />} />
                        
                        {/* Info Pages */}
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/contact" element={<ContactPage />} />
                        <Route path="/faq" element={<FAQPage />} />
                        <Route path="/privacy" element={<PrivacyPolicyPage />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                        <Route path="/returns" element={<ReturnsPage />} />
                        <Route path="/shipping" element={<ShippingPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/trust-safety" element={<TrustSafetyPage />} />
                        <Route path="/accessibility" element={<AccessibilityPage />} />
                        <Route path="/photography-standard" element={<PhotographyStandardPage />} />
                        <Route path="/photography-guide" element={<PhotographyStandardPage />} />
                        
                        {/* --- PROTECTED ADMIN ROUTES (NESTED UNDER ADMINLAYOUT) --- */}
                        <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
                          <Route index element={<AdminDashboard />} />
                          <Route path="events" element={<EventsAdminPage />} />
                          <Route path="products" element={<ProductManagementPage />} />
                          <Route path="users" element={<UserManagementPage />} />
                          <Route path="users/:userId" element={<UserDetailPage />} />
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
                          <Route path="media" element={<MediaLibraryPage />} />
                          <Route path="marketplace" element={<MarketplaceManagementPage />} />
                          <Route path="category-mapping" element={<CategoryMappingPage />} />
                          <Route path="verification" element={<AdminVerificationDashboard />} />
                          <Route path="commissions" element={<CommissionSettingsPage />} />
                          <Route path="product-lines" element={<ProductLinesManagementPage />} />
                          <Route path="collections" element={<CollectionsManagementPage />} />
                          <Route path="featured" element={<FeaturedCardsAdminPage />} />
                          <Route path="all-listings" element={<ListingsManagementPage />} />
                        </Route>
                        
                        {/* --- CATCH-ALL 404 ROUTE --- */}
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </Suspense>
                    </RouteErrorBoundary>
                  </main>
                  
                  <Footer />
                  <ShoppingCart />
                  <Toaster position="bottom-right" richColors closeButton />
                </div>
              </Router>
            </CategoryHierarchyProvider>
          </CartProvider>
        </AdminProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
