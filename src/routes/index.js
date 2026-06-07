import { Router } from 'express';
import { loginLimiter, passwordResetLimiter, apiLimiter, stripeLimiter } from '../middleware/endpoint-rate-limit.js';
import { verifyTradeAccess } from '../middleware/verifyTradeAccess.js';
import { authMiddleware } from '../middleware/auth.js';
import healthCheck from './health-check.js';
import ebayRouter from './ebay.js';
import authRouter from './auth/index.js';
import stripeRouter from './stripe.js';
import verificationRouter from './verification.js';
import integratedAiRouter from './integrated-ai.js';
import cardOcrRouter from './card-ocr.js';
import eventScraperRouter from './event-scraper.js';
import categoriesRouter from './categories.js';
import subcategoriesRouter from './subcategories.js';
import vaultRouter from './vault.js';
import newsletterRouter from './newsletter.js';

const router = Router();

export default () => {
    // Health check - no rate limiting
    router.get('/health', healthCheck);
    
    // Google verification endpoint - no rate limiting, no auth required
    router.use('/', verificationRouter);
    
    // Integrated AI routes with rate limiting
    router.use('/integrated-ai', integratedAiRouter);

    // Card OCR routes with rate limiting
    router.use('/card-ocr', cardOcrRouter);
    
    // Event scraper routes with API rate limiting
    router.use('/event-scraper', apiLimiter);
    router.use('/event-scraper', eventScraperRouter);
    
    // Auth routes with endpoint-specific rate limiting
    router.use('/auth/login', loginLimiter);
    router.use('/auth/password/reset/request', passwordResetLimiter);
    router.use('/auth', authRouter);
    
    // eBay routes with API rate limiting
    router.use('/ebay', apiLimiter);
    router.use('/ebay', ebayRouter);
    
    // Stripe: high-capacity limiter for the webhook, standard for other endpoints
    router.use('/stripe/webhook', stripeLimiter);
    router.use('/stripe', apiLimiter);
    router.use('/stripe', stripeRouter);

    // Category management routes with API rate limiting
    router.use('/categories', apiLimiter);
    router.use('/categories', categoriesRouter);

    // Subcategory management routes with API rate limiting
    router.use('/subcategories', apiLimiter);
    router.use('/subcategories', subcategoriesRouter);

    // Vault security routes with API rate limiting
    router.use('/vault', apiLimiter);
    router.use('/vault', vaultRouter);

    // Newsletter (Kit.com) subscription — no auth required
    router.use('/newsletter', apiLimiter);
    router.use('/newsletter', newsletterRouter);

    // Trade routes with email verification middleware
    // Apply auth middleware first, then trade access verification
    // This protects any route containing 'trade' in the path
    router.use((req, res, next) => {
        // Check if this is a trade route
        if (req.path.toLowerCase().includes('trade')) {
            // Apply auth middleware for trade routes
            return authMiddleware(req, res, () => {
                // Then apply trade access verification
                verifyTradeAccess(req, res, next);
            });
        }
        // For non-trade routes, just continue
        next();
    });

    return router;
};
