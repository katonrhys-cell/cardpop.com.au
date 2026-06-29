import logger from '../utils/logger.js';
import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

// Populate req.user when a valid Bearer token is present so logged-in users
// receive personalized recommendations; anonymous callers fall back to popular.
router.use(optionalAuthMiddleware);

// Get personalized recommendations for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit) || 12;
    
    if (!userId) {
      // Return popular items for non-authenticated users
      const { data: popularItems, error: popularError } = await supabase
        .from('listings')
        .select('*, vault_item:vault_items(*, vault_images(*)), seller:profiles(display_name, username, avatar_url)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (popularError) throw popularError;

      return res.json({
        recommendations: popularItems || [],
        type: 'popular'
      });
    }

    // Get user's wishlist
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('item_id, item_type')
      .eq('user_id', userId);

    if (wishlistError) throw wishlistError;

    // Get user's recently viewed (from localStorage concept, using order history as proxy)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('item_id, item_type')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (ordersError) throw ordersError;

    // Combine user interests
    const userInterests = new Set();
    wishlist?.forEach(item => userInterests.add(item.item_type));
    orders?.forEach(item => userInterests.add(item.item_type));

    // Get recommendations based on user interests
    let recommendations = [];
    
    if (userInterests.size > 0) {
      const interestTypes = Array.from(userInterests);
      
      // Get similar items based on categories
      const { data: similarItems, error: similarError } = await supabase
        .from('listings')
        .select('*, vault_item:vault_items(*, vault_images(*)), seller:profiles(display_name, username, avatar_url)')
        .eq('status', 'active')
        .in('category', interestTypes)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!similarError && similarItems) {
        recommendations = similarItems;
      }
    }

    // If no recommendations, get popular items
    if (recommendations.length === 0) {
      const { data: popularItems, error: popularError } = await supabase
        .from('listings')
        .select('*, vault_item:vault_items(*, vault_images(*)), seller:profiles(display_name, username, avatar_url)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!popularError && popularItems) {
        recommendations = popularItems;
      }
    }

    res.json({
      recommendations: recommendations || [],
      type: userInterests.size > 0 ? 'personalized' : 'popular'
    });
  } catch (error) {
    logger.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Get "You might also like" recommendations for a specific item
router.get('/similar/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const limit = parseInt(req.query.limit) || 8;

    // Get the item's category
    const { data: item, error: itemError } = await supabase
      .from('listings')
      .select('category, vault_item:vault_items(category)')
      .eq('id', itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const category = item.category || item.vault_item?.category;

    if (!category) {
      // Return popular items if no category
      const { data: popularItems, error: popularError } = await supabase
        .from('listings')
        .select('*, vault_item:vault_items(*, vault_images(*)), seller:profiles(display_name, username, avatar_url)')
        .eq('status', 'active')
        .neq('id', itemId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (popularError) throw popularError;

      return res.json(popularItems || []);
    }

    // Get similar items in the same category
    const { data: similarItems, error: similarError } = await supabase
      .from('listings')
      .select('*, vault_item:vault_items(*, vault_images(*)), seller:profiles(display_name, username, avatar_url)')
      .eq('status', 'active')
      .neq('id', itemId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (similarError) throw similarError;

    res.json(similarItems || []);
  } catch (error) {
    logger.error('Error generating similar items:', error);
    res.status(500).json({ error: 'Failed to generate similar items' });
  }
});

export default router;
