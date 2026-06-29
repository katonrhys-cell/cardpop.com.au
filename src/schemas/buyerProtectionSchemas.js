import { z } from 'zod';

export const createClaimSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  claim_type: z.enum(['item_not_received', 'item_not_as_described', 'damaged', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be at most 1000 characters'),
});

export const updateClaimStatusSchema = z.object({
  status: z.enum(['pending', 'investigating', 'resolved', 'rejected']),
  resolution: z.string().optional(),
  refund_amount: z.number().positive('Refund amount must be positive').optional(),
});
