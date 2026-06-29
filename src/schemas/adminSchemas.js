import { z } from 'zod';

export const setUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const setUserRoleBodySchema = z.object({
  is_admin: z.boolean({ errorMap: () => ({ message: 'is_admin must be a boolean' }) }),
});

export const reviewVerificationSchema = z.object({
  id: z.string().min(1, 'Verification ID is required'),
});

export const reviewVerificationBodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended', 'revoked', 'info_requested']).optional(),
  admin_notes: z.string().max(1000, 'Admin notes must be 1000 characters or less').optional(),
  additional_info_requested: z.string().max(1000, 'Info request must be 1000 characters or less').optional(),
  info_request: z.boolean().optional(),
}).refine(
  (data) => data.info_request || data.status,
  { message: 'Either info_request or a valid status is required' }
);

export const processRefundSchema = z.object({
  id: z.string().min(1, 'Refund ID is required'),
});

export const processRefundBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  admin_notes: z.string().max(1000, 'Admin notes must be 1000 characters or less').optional(),
  rejection_reason: z.string().max(1000, 'Rejection reason must be 1000 characters or less').optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.rejection_reason?.trim()),
  { message: 'A rejection reason is required when action is reject' }
);

export const getDisputesSchema = z.object({
  status: z.enum(['open', 'all']).optional(),
});

export const resolveDisputeSchema = z.object({
  id: z.string().min(1, 'Dispute ID is required'),
});

export const resolveDisputeBodySchema = z.object({
  action: z.enum(['release', 'keep_frozen']),
  resolution_notes: z.string().max(1000, 'Resolution notes must be 1000 characters or less').optional(),
});
