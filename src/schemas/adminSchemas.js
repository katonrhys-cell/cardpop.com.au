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

export const setUserStatusSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const setUserStatusBodySchema = z.object({
  status: z.enum(['active', 'suspended', 'deleted']),
});

// business_profiles: an admin-curated directory of physical retail locations
// (distinct from the self-service profiles.is_sole_trader /dealer storefront).
const businessProfileFields = {
  business_name: z.string().min(1, 'Business name is required').max(200),
  tagline: z.string().max(160).optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  business_type: z.string().max(100).optional().nullable(),
  website_url: z.string().url('Must be a valid URL').max(500).optional().nullable().or(z.literal('')),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email('Must be a valid email').max(320).optional().nullable().or(z.literal('')),
  logo_url: z.string().url('Must be a valid URL').max(1000).optional().nullable().or(z.literal('')),
  has_physical_store: z.boolean().optional(),
  store_address: z.string().max(300).optional().nullable(),
  store_suburb: z.string().max(120).optional().nullable(),
  store_state: z.string().max(10).optional().nullable(),
  store_postcode: z.string().max(10).optional().nullable(),
};

export const createBusinessProfileBodySchema = z.object({
  ...businessProfileFields,
  business_name: businessProfileFields.business_name, // required on create
  user_email: z.string().email('A valid user email is required to link the storefront to an account'),
  storefront_status: z.enum(['pending_review', 'approved', 'suspended']).optional(),
});

export const businessProfileIdSchema = z.object({
  id: z.string().min(1, 'Business profile ID is required'),
});

export const updateBusinessProfileBodySchema = z.object({
  ...Object.fromEntries(Object.entries(businessProfileFields).map(([k, v]) => [k, v.optional()])),
  storefront_status: z.enum(['pending_review', 'approved', 'suspended']).optional(),
  rejection_reason: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' }
);
