import { z } from 'zod';

export const getRecommendationsSchema = z.object({
  limit: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional(),
});

export const getSimilarItemsSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
});

export const getSimilarItemsQuerySchema = z.object({
  limit: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional(),
});
