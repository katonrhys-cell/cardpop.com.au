import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client for backend
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:8000',
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Get seller ratings and stats
router.get('/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;

    // Get all ratings for this seller
    const { data: ratings, error: ratingsError } = await supabase
      .from('seller_ratings')
      .select('rating, comment, created_at, reviewer:profiles!reviewer_id(display_name, avatar_url)')
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
    console.error('Error fetching seller ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Create a new rating
router.post('/', async (req, res) => {
  try {
    const { seller_id, reviewer_id, rating, comment, order_id } = req.body;

    if (!seller_id || !reviewer_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if user already rated this seller for this order
    const { data: existing, error: checkError } = await supabase
      .from('seller_ratings')
      .select('id')
      .eq('seller_id', seller_id)
      .eq('reviewer_id', reviewer_id)
      .eq('order_id', order_id)
      .single();

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
        order_id: order_id || null
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update seller's average rating and total ratings
    await updateSellerStats(seller_id);

    res.status(201).json(newRating);
  } catch (error) {
    console.error('Error creating rating:', error);
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
          average_rating: parseFloat(average),
          total_ratings: ratings.length
        })
        .eq('id', sellerId);
    }
  } catch (error) {
    console.error('Error updating seller stats:', error);
  }
}

// Update seller performance metrics
router.put('/:sellerId/performance', async (req, res) => {
  try {
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
    console.error('Error updating seller performance:', error);
    res.status(500).json({ error: 'Failed to update performance' });
  }
});

export default router;
