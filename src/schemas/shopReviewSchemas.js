import { z } from 'zod';

export const createShopReviewSchema = z.object({
  order_id: z.string().uuid('Order ID is required'),
  product_id: z.string().uuid('Product ID is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  title: z.string().trim().max(120, 'Title must be 120 characters or less').optional(),
  body: z.string().trim().max(2000, 'Review must be 2000 characters or less').optional(),
});

export const listShopReviewsQuerySchema = z.object({
  status: z.enum(['pending', 'published', 'rejected']).optional(),
});

export const moderateShopReviewSchema = z.object({
  status: z.enum(['published', 'rejected', 'pending']),
  note: z.string().trim().max(500).optional(),
});
