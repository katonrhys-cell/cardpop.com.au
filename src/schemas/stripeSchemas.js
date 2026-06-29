import { z } from 'zod';

export const createCheckoutSchema = z.object({
  listingId: z.string().optional(),
  offerId: z.string().uuid().optional(),
  bidId: z.string().uuid().optional(),
  transactionType: z.enum(['fixed', 'auction', 'trade', 'offer']).default('fixed'),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  shippingAddress: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    suburb: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
  }).optional(),
});

export const calculateBreakdownSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  transactionType: z.enum(['fixed', 'auction', 'trade', 'offer']).default('fixed'),
});

export const processRefundSchema = z.object({
  refundId: z.string().uuid('Invalid refund ID'),
});
