import { z } from 'zod';

export const addWishlistSchema = z.object({
  item_id: z.string().min(1, 'Item ID is required'),
  item_type: z.enum(['vault_item', 'product', 'listing'], { errorMap: () => ({ message: 'Invalid item type' }) }),
});

export const removeWishlistSchema = z.object({
  itemId: z.string().min(1, 'Wishlist item ID is required'),
});

export const checkWishlistSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  itemType: z.enum(['vault_item', 'product', 'listing'], { errorMap: () => ({ message: 'Invalid item type' }) }),
});
