import { z } from 'zod';
import { CARRIER_IDS, isValidTrackingNumber } from '../../utils/shipmentTracking.js';

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
  // Notes are optional in the UI and sent as `notes.trim() || null`, so the
  // schema must accept null (z .optional() alone rejects null → 400 whenever an
  // admin approves/rejects without typing a note).
  admin_notes: z.string().max(1000, 'Admin notes must be 1000 characters or less').optional().nullable(),
  additional_info_requested: z.string().max(1000, 'Info request must be 1000 characters or less').optional().nullable(),
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

export const shipOrderSchema = z.object({
  id: z.string().uuid('Invalid order ID'),
});

export const shipOrderBodySchema = z.object({
  carrier: z.enum(CARRIER_IDS),
  tracking_number: z.string().refine(isValidTrackingNumber, 'Tracking number must be 4–40 letters, digits or dashes'),
  // Email the buyer their tracking link. Defaults on; off lets an admin fix a
  // typo'd reference without a second email.
  notify: z.boolean().optional().default(true),
});

export const getDisputesSchema = z.object({
  // The admin filter offers the resolved terminal statuses too, and the handler
  // already branches on them — the enum must allow them or the query 400s.
  status: z.enum(['open', 'all', 'resolved_released', 'resolved_kept']).optional(),
});

// Admin -> Offers. 'open' = pending or countered (waiting on a response);
// 'awaiting_payment' = accepted but not yet paid; 'paid' = checkout completed.
export const OFFER_ADMIN_FILTERS = ['all', 'open', 'pending', 'countered', 'awaiting_payment', 'paid', 'declined', 'expired', 'withdrawn'];
export const getOffersSchema = z.object({
  status: z.enum(OFFER_ADMIN_FILTERS).optional(),
});

export const resolveDisputeSchema = z.object({
  id: z.string().min(1, 'Dispute ID is required'),
});

export const resolveDisputeBodySchema = z.object({
  action: z.enum(['release', 'keep_frozen']),
  // Sent as `notes.trim() || null` and labelled optional in the UI — accept null.
  resolution_notes: z.string().max(1000, 'Resolution notes must be 1000 characters or less').optional().nullable(),
});

export const setUserStatusSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const setUserStatusBodySchema = z.object({
  status: z.enum(['active', 'suspended', 'deleted']),
});

export const identityReviewSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const identityReviewBodySchema = z.object({
  decision: z.enum(['approve', 'reject']),
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

// Card-art overrides: admin-uploaded artwork for cards (see src/routes/admin.js
// card-art endpoints). The image is uploaded to storage client-side; the body
// carries the resulting URL/path plus the card identity used to build the key.
export const createCardArtBodySchema = z.object({
  name: z.string().min(1, 'Card name is required').max(200),
  card_set: z.string().max(200).optional().nullable(),
  collection: z.string().max(100).optional().nullable(),
  image_url: z.string().url('A valid image URL is required'),
  storage_path: z.string().max(500).optional().nullable(),
});

export const cardArtIdSchema = z.object({
  id: z.string().min(1, 'Card art ID is required'),
});

export const updateBusinessProfileBodySchema = z.object({
  ...Object.fromEntries(Object.entries(businessProfileFields).map(([k, v]) => [k, v.optional()])),
  storefront_status: z.enum(['pending_review', 'approved', 'suspended']).optional(),
  rejection_reason: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' }
);
