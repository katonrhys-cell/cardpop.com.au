import { z } from 'zod';

export const getMarketDataSchema = z.object({
  cardName: z.string().min(1, 'Card name is required'),
});

export const recordMarketDataSchema = z.object({
  card_name: z.string().min(1, 'Card name is required'),
  set_name: z.string().optional(),
  source: z.string().min(1, 'Source is required'),
  market_price: z.union([z.number(), z.string()]).transform(v => parseFloat(v)).pipe(z.number().positive('Market price must be positive')),
  low_price: z.union([z.number(), z.string()]).transform(v => v === '' || v === null ? null : parseFloat(v)).pipe(z.number().positive('Low price must be positive')).nullable().optional(),
  mid_price: z.union([z.number(), z.string()]).transform(v => v === '' || v === null ? null : parseFloat(v)).pipe(z.number().positive('Mid price must be positive')).nullable().optional(),
  high_price: z.union([z.number(), z.string()]).transform(v => v === '' || v === null ? null : parseFloat(v)).pipe(z.number().positive('High price must be positive')).nullable().optional(),
  currency: z.string().toUpperCase().length(3).default('USD'),
});

export const compareMarketPricesSchema = z.object({
  cardName: z.string().min(1, 'Card name is required'),
});

export const getTrendingSchema = z.object({
  limit: z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive('Limit must be a positive integer')),
});
