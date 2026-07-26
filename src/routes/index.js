import { Router } from 'express';
import { loginLimiter, passwordResetLimiter, apiLimiter, stripeLimiter, pwnedCheckLimiter } from '../middleware/endpoint-rate-limit.js';
import { verifyTradeAccess } from '../middleware/verifyTradeAccess.js';
import { authMiddleware } from '../middleware/auth.js';
import healthCheck from './health-check.js';
import mcpRouter from './mcp.js';
import ebayRouter from './ebay.js';
import cardsightRouter from './cardsight.js';
import authRouter from './auth/index.js';
import stripeRouter from './stripe.js';
import subscriptionRouter from './subscription.js';
import verificationRouter from './verification.js';
import integratedAiRouter from './integrated-ai.js';
import cardOcrRouter from './card-ocr.js';
import cardDescriptionRouter from './card-description.js';
import gradeEstimatorRouter from './grade-estimator.js';
import eventScraperRouter from './event-scraper.js';
import eventScanRouter from './event-scan.js';
import eventsRouter from './events.js';
import categoriesRouter from './categories.js';
import subcategoriesRouter from './subcategories.js';
import vaultRouter from './vault.js';
import photoTemplateRouter from './photo-template.js';
import searchSuggestionsRouter from './search-suggestions.js';
import sellerRatingsRouter from './seller-ratings.js';
import buyerProtectionRouter from './buyer-protection.js';
import wishlistRouter from './wishlist.js';
import recommendationsRouter from './recommendations.js';
import priceHistoryRouter from './price-history.js';
import newsletterRouter from './newsletter.js';
import contactRouter from './contact.js';
import dataDeletionRouter from './data-deletion.js';
import marketDataRouter from './market-data.js';
import pricesRouter from './prices.js';
import storesRouter from './stores.js';
import catalogRouter from './catalog.js';
import psaRouter from './psa.js';
import gradingVerificationRouter from './grading-verification.js';
import welcomeOfferRouter from './welcome-offer.js';
import partnersRouter from './partners.js';
import walletRouter from './wallet.js';
import refundsRouter from './refunds.js';
import adminRouter from './admin.js';
import settingsRouter from './settings.js';
import reportsRouter from './reports.js';
import blogRouter from './blog.js';

const router = Router();

export default () => {
    // Health check - no rate limiting
    router.get('/health', healthCheck);

    // MCP server (read-only tools for AI agents) with API rate limiting
    router.use('/mcp', apiLimiter);
    router.use('/mcp', mcpRouter);

    // Google verification endpoint - no rate limiting, no auth required
    router.use('/', verificationRouter);
    
    // Integrated AI routes with rate limiting
    router.use('/integrated-ai', integratedAiRouter);

    // Card OCR routes with rate limiting
    router.use('/card-ocr', cardOcrRouter);

    // AI SEO description generation with rate limiting
    router.use('/card-description', cardDescriptionRouter);

    // Grade estimator routes with rate limiting
    router.use('/grade-estimator', gradeEstimatorRouter);

    // Event scraper routes with API rate limiting
    router.use('/event-scraper', apiLimiter);
    router.use('/event-scraper', eventScraperRouter);

    // Nightly event scanner — admin management of its source list. Triggering a
    // scan lives on its own 300s function at /cron/event-scan, not here.
    router.use('/event-scan', apiLimiter);
    router.use('/event-scan', eventScanRouter);

    // Event submission notifications (admin heads-up on user-submitted events)
    router.use('/events', apiLimiter);
    router.use('/events', eventsRouter);
    
    // Auth routes with endpoint-specific rate limiting
    router.use('/auth/login', loginLimiter);
    router.use('/auth/password/reset/request', passwordResetLimiter);
    router.use('/auth/password/pwned-check', pwnedCheckLimiter);
    router.use('/auth', authRouter);
    
    // eBay routes with API rate limiting
    router.use('/ebay', apiLimiter);
    router.use('/ebay', ebayRouter);

    // PSA certification routes with API rate limiting
    router.use('/psa', apiLimiter);
    router.use('/psa', psaRouter);

    // Grading (PSA/Beckett) cert verification routes with API rate limiting
    router.use('/grading-verification', apiLimiter);
    router.use('/grading-verification', gradingVerificationRouter);

    // CardSight AI identification routes (image recognition only)
    router.use('/cardsight', apiLimiter);
    router.use('/cardsight', cardsightRouter);

    // Free-API-backed card catalog search and eBay pricing
    router.use('/catalog', apiLimiter);
    router.use('/catalog', catalogRouter);
    
    // Stripe: high-capacity limiter for the webhook, standard for other endpoints.
    // The apiLimiter mount below must skip the webhook sub-path — otherwise a
    // burst of Stripe retries hits both limiters and gets throttled at the
    // standard 100/min cap despite stripeLimiter's 1000/min allowance (req.path
    // here is relative to the '/stripe' mount, so the webhook is '/webhook').
    router.use('/stripe/webhook', stripeLimiter);
    router.use('/stripe', (req, res, next) => (req.path === '/webhook' ? next() : apiLimiter(req, res, next)));
    router.use('/stripe', stripeRouter);

    // Membership / free-trial subscription (Stripe + PayPal). The PayPal webhook
    // uses the high-capacity limiter; other endpoints use the standard limiter.
    router.use('/subscription/paypal/webhook', stripeLimiter);
    router.use('/subscription', (req, res, next) => (req.path === '/paypal/webhook' ? next() : apiLimiter(req, res, next)));
    router.use('/subscription', subscriptionRouter);

    // Category management routes with API rate limiting
    router.use('/categories', apiLimiter);
    router.use('/categories', categoriesRouter);

    // Subcategory management routes with API rate limiting
    router.use('/subcategories', apiLimiter);
    router.use('/subcategories', subcategoriesRouter);

    // Vault security routes with API rate limiting
    router.use('/vault', apiLimiter);
    router.use('/vault', vaultRouter);

    // Photo template routes with API rate limiting
    router.use('/photo-template', apiLimiter);
    router.use('/photo-template', photoTemplateRouter);

    // Marketplace feature routes with API rate limiting
    router.use('/seller-ratings', apiLimiter);
    router.use('/seller-ratings', sellerRatingsRouter);

    router.use('/wishlist', apiLimiter);
    router.use('/wishlist', wishlistRouter);

    router.use('/recommendations', apiLimiter);
    router.use('/recommendations', recommendationsRouter);

    router.use('/market-data', apiLimiter);
    router.use('/market-data', marketDataRouter);

    router.use('/price-history', apiLimiter);
    router.use('/price-history', priceHistoryRouter);

    // Public card price pages: snapshot refresh (cron + on-demand)
    router.use('/prices', apiLimiter);
    router.use('/prices', pricesRouter);

    // Local game store directory submissions
    router.use('/stores', apiLimiter);
    router.use('/stores', storesRouter);

    router.use('/buyer-protection', apiLimiter);
    router.use('/buyer-protection', buyerProtectionRouter);

    router.use('/search-suggestions', apiLimiter);
    router.use('/search-suggestions', searchSuggestionsRouter);

    // Newsletter subscription
    router.use('/newsletter', apiLimiter);
    router.use('/newsletter', newsletterRouter);

    // Public contact form → support inbox (Resend)
    router.use('/contact', apiLimiter);
    router.use('/contact', contactRouter);

    // Meta (Facebook) data deletion request callback + public status lookup.
    // No auth: the callback is called server-to-server by Facebook and is
    // authenticated by the signed_request HMAC signature, not a Bearer token.
    router.use('/data-deletion', apiLimiter);
    router.use('/data-deletion', dataDeletionRouter);

    // Registration welcome offer (code issue / trial redemption)
    router.use('/welcome-offer', apiLimiter);
    router.use('/welcome-offer', welcomeOfferRouter);

    // Partner program (applications, dashboard, referral tracking, payouts)
    router.use('/partners', apiLimiter);
    router.use('/partners', partnersRouter);

    // Buyer prepaid wallet (Stripe Customer Balance top-up + balance read)
    router.use('/wallet', apiLimiter);
    router.use('/wallet', walletRouter);

    // Buyer-initiated refund requests (server-side so orders/notifications
    // writes aren't silently RLS-denied like the old client path).
    router.use('/refunds', apiLimiter);
    router.use('/refunds', refundsRouter);

    // Privileged admin operations (service-role writes gated by authMiddleware +
    // isAdminUser inside the router itself). Was fully built and tested but never
    // actually mounted, so every one of these endpoints 404'd in production.
    router.use('/admin', apiLimiter);
    router.use('/admin', adminRouter);

    // Public platform settings (feature flags, maintenance switch, listing-form
    // limits). No auth — read by every client, including logged-out visitors.
    router.use('/settings', apiLimiter);
    router.use('/settings', settingsRouter);

    // Content reports: POST / (user submits a scam/counterfeit report),
    // GET / + PATCH /:id (admin triage). The router carries its own
    // authMiddleware / requireAdmin / reportLimiter.
    router.use('/reports', apiLimiter);
    router.use('/reports', reportsRouter);

    // Blog article topic queue — admin only (the router applies
    // authMiddleware + isAdminUser to every route inside it). The scheduled
    // generation entrypoint is NOT here: it's api/blog-generate.js, reached
    // via the /cron/blog-generate rewrite with a CRON_SECRET bearer.
    router.use('/blog', apiLimiter);
    router.use('/blog', blogRouter);

    // Trade routes with email verification middleware
    // Apply auth middleware first, then trade access verification
    // This protects any route containing 'trade' in the path
    router.use((req, res, next) => {
        if (req.path.toLowerCase().startsWith('/trade')) {
            return authMiddleware(req, res, () => {
                verifyTradeAccess(req, res, next);
            });
        }
        next();
    });

    return router;
};
