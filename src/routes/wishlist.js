import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

// Populate req.user when a valid Bearer token is present. The handlers below
// enforce authentication themselves (returning 401 when req.user is absent),
// while the public /check route degrades gracefully for anonymous callers.
router.use(optionalAuthMiddleware);

// Get user's wishlist
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: wishlist, error } = await supabase
      .from('wishlists')
      .select('*, vault_item:vault_items(*, vault_images(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(wishlist || []);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// Add item to wishlist
router.post('/', async (req, res) => {
  try {
    const { item_id, item_type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!item_id || !item_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['vault_item', 'product', 'listing'];
    if (!validTypes.includes(item_type)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', item_id)
      .eq('item_type', item_type)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Item already in wishlist' });
    }

    const { data: wishlistItem, error } = await supabase
      .from('wishlists')
      .insert({
        user_id: userId,
        item_id,
        item_type
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// Remove item from wishlist
router.delete('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// Check if item is in wishlist
router.get('/check/:itemId/:itemType', async (req, res) => {
  try {
    const { itemId, itemType } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.json({ inWishlist: false });
    }

    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .single();

    res.json({ inWishlist: !!existing });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.json({ inWishlist: false });
  }
});

export default router;
