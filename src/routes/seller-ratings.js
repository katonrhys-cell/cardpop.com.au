import logger from '../utils/logger.js';
import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, optionalAuthMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import { getSellerRatingsSchema, createRatingSchema, updatePerformanceSchema, updatePerformanceBodySchema } from '../schemas/sellerRatingSchemas.js';

const router = Router();

// Reading a seller's ratings is public; writes require authentication and are
// gated per-route below. The backend uses the service-role key (bypassing RLS),
// so these checks are the only thing enforcing the schema's intended policy:
// "auth.uid() = reviewer_id AND the reviewer participated in the order".
router.use(optionalAuthMiddleware);

// Ratings the signed-in user has written, with the reviewed seller embedded.
// Serves the account Reviews "Given" tab and lets the orders page mark which
// orders already have a review. Registered before /:sellerId for clarity, but
// the two-segment path can't collide with it either way.
router.get('/mine/given', authMiddleware, async (req, res) => {
  try {
    const { data: ratings, error } = await supabase
      .from('seller_ratings')
      .select('id, order_id, seller_id, rating, comment, created_at, seller:profiles!seller_id(display_name, username, avatar_url, is_verified)')
      .eq('reviewer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ ratings: ratings || [] });
  } catch (error) {
    logger.error('Error fetching given ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Get seller ratings and stats
router.get('/:sellerId', validateRequestParams(getSellerRatingsSchema), async (req, res) => {
  try {
    const { sellerId } = req.params;

    // Get all ratings for this seller
    const { data: ratings, error: ratingsError } = await supabase
      .from('seller_ratings')
      .select('id, order_id, rating, comment, created_at, reviewer:profiles!reviewer_id(display_name, username, avatar_url, is_verified)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (ratingsError) throw ratingsError;

    // Calculate rating statistics
    const ratingStats = {
      average: 0,
      total: ratings?.length || 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    if (ratings && ratings.length > 0) {
      const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
      ratingStats.average = (sum / ratings.length).toFixed(1);
      
      ratings.forEach(r => {
        ratingStats.distribution[r.rating] = (ratingStats.distribution[r.rating] || 0) + 1;
      });
    }

    // Get seller performance metrics
    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('response_time, successful_sales, total_sales')
      .eq('id', sellerId)
      .single();

    if (sellerError && sellerError.code !== 'PGRST116') throw sellerError;

    res.json({
      ratings: ratings || [],
      stats: ratingStats,
      performance: seller || null
    });
  } catch (error) {
    logger.error('Error fetching seller ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Create a new rating
router.post('/', authMiddleware, validateRequestBody(createRatingSchema), async (req, res) => {
  try {
    const { seller_id, rating, comment, order_id } = req.body;
    // Never trust a client-supplied reviewer_id — derive it from the token.
    const reviewer_id = req.user.id;

    if (seller_id === reviewer_id) {
      return res.status(400).json({ error: 'You cannot rate yourself' });
    }

    // Verify the reviewer actually participated in this order as the buyer,
    // and that the order belongs to the seller being rated.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('buyer_id, seller_id, status')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.buyer_id !== reviewer_id || order.seller_id !== seller_id) {
      return res.status(403).json({ error: 'You can only rate sellers for your own completed orders' });
    }

    // A review reflects a lived transaction: allow it once the seller has
    // shipped (or the order finished, including in a refund) — not while the
    // order is merely paid, failed, or cancelled.
    if (!['shipped', 'completed', 'refunded'].includes(order.status)) {
      return res.status(400).json({ error: 'You can leave a review once your order has shipped' });
    }

    // Check if user already rated this seller for this order
    const { data: existing } = await supabase
      .from('seller_ratings')
      .select('id')
      .eq('reviewer_id', reviewer_id)
      .eq('order_id', order_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'You have already rated this seller for this order' });
    }

    // Create the rating
    const { data: newRating, error: createError } = await supabase
      .from('seller_ratings')
      .insert({
        seller_id,
        reviewer_id,
        rating,
        comment: comment || null,
        order_id
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update seller's average rating and total ratings
    await updateSellerStats(seller_id);

    // Tell the seller (best-effort — a notification failure must not fail the review).
    await supabase.from('notifications').insert({
      user_id: seller_id,
      type: 'review_received',
      title: 'New Review Received',
      body: `A buyer left you a ${rating}-star review.`,
    }).then(() => {}, () => {});

    res.status(201).json(newRating);
  } catch (error) {
    logger.error('Error creating rating:', error);
    res.status(500).json({ error: 'Failed to create rating' });
  }
});

// Helper function to update seller stats
async function updateSellerStats(sellerId) {
  try {
    const { data: ratings } = await supabase
      .from('seller_ratings')
      .select('rating')
      .eq('seller_id', sellerId);

    if (ratings && ratings.length > 0) {
      const average = (ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1);
      
      await supabase
        .from('profiles')
        .update({
          rating: parseFloat(average),
          reviews_count: ratings.length
        })
        .eq('id', sellerId);
    }
  } catch (error) {
    logger.error('Error updating seller stats:', error);
  }
}

// Update seller performance metrics — admin only (overwrites profile stats).
router.put('/:sellerId/performance', authMiddleware, requireAdmin, validateRequestParams(updatePerformanceSchema), validateRequestBody(updatePerformanceBodySchema), async (req, res) => {
  try {
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { sellerId } = req.params;
    const { response_time, successful_sales, total_sales } = req.body;

    const { data, error } = await supabase
      .from('profiles')
      .update({
        response_time,
        successful_sales,
        total_sales
      })
      .eq('id', sellerId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    logger.error('Error updating seller performance:', error);
    res.status(500).json({ error: 'Failed to update performance' });
  }
});

export default router;
