import { z } from 'zod';

// Accept a bare "example.com" and store https://example.com — members type
// links the way they say them.
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withScheme);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
      return u.toString();
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid website or social link' });
      return z.NEVER;
    }
  });

const optionalText = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const storeOwnerRequestBodySchema = z.object({
  storeId: z.string().uuid('Choose your shop from the list'),
  roleTitle: optionalText(80),
  websiteUrl: optionalUrl,
  message: optionalText(1000),
});

export const storeOwnerRequestIdSchema = z.object({
  id: z.string().uuid('Invalid request id'),
});

export const storeOwnerDecisionBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: optionalText(1000),
}).superRefine((v, ctx) => {
  if (v.action === 'reject' && !v.note) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Give a reason so they know what to fix' });
  }
});
