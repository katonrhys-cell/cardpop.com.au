import { z } from 'zod';

export const createCheckoutSchema = z.object({
  listingId: z.string().min(1, 'listingId is required').optional(),
  offerId: z.string().min(1).optional(),
  bidId: z.string().min(1).optional(),
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
  promoCode: z.string().trim().max(32).optional(),
  useWalletBalance: z.boolean().optional(),
}).refine(
  (data) => data.listingId || data.offerId || data.bidId,
  { message: 'One of listingId, offerId, or bidId is required' }
).refine(
  (data) => !(data.promoCode && data.useWalletBalance),
  { message: 'Apply either a promo code or your wallet balance, not both.' }
);

export const calculateBreakdownSchema = z.object({
  listingId: z.string().min(1, 'listingId is required'),
  transactionType: z.enum(['fixed', 'auction', 'trade', 'offer']).default('fixed'),
});

export const processRefundSchema = z.object({
  refundId: z.string().min(1, 'refundId is required'),
});
