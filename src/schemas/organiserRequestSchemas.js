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

export const organiserRequestBodySchema = z.object({
  organiserName: z.string().trim().min(2, 'Enter your organiser or business name').max(120),
  websiteUrl: optionalUrl,
  message: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  // The directory entry they say is theirs (claiming an existing page).
  organiserId: z.string().uuid().optional().nullable(),
});

export const organiserRequestIdSchema = z.object({
  id: z.string().uuid('Invalid request id'),
});

export const organiserDecisionBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  // Approve: link this existing directory entry; omitted = create one from the request's name.
  organiserId: z.string().uuid().optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.action === 'reject' && !v.note) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Give a reason so they know what to fix' });
  }
});
