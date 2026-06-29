import { z } from 'zod';

export const getSellerRatingsSchema = z.object({
  sellerId: z.string().min(1, 'Seller ID is required'),
});

export const createRatingSchema = z.object({
  seller_id: z.string().min(1, 'Seller ID is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().max(1000, 'Comment must be 1000 characters or less').optional(),
  order_id: z.string().min(1, 'Order ID is required'),
});

export const updatePerformanceSchema = z.object({
  sellerId: z.string().min(1, 'Seller ID is required'),
});

export const updatePerformanceBodySchema = z.object({
  response_time: z.string().optional(),
  successful_sales: z.number().int().nonnegative('Successful sales must be non-negative').optional(),
  total_sales: z.number().int().nonnegative('Total sales must be non-negative').optional(),
});
