import { z } from 'zod';

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
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid link' });
      return z.NEVER;
    }
  });

const optionalText = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const playerRequestBodySchema = z.object({
  name: z.string().trim().min(2, 'Enter the player’s full name').max(120),
  sport: z.string().trim().min(1, 'Pick the sport').max(60),
  team: optionalText(120),
  referenceUrl: optionalUrl,
  note: optionalText(1000),
});

export const playerRequestIdSchema = z.object({
  id: z.string().uuid('Invalid request id'),
});

export const playerRequestDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: optionalText(1000),
  // Approve: link an existing player instead of creating a draft.
  playerId: z.string().uuid().optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.action === 'reject' && !v.note) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Give a reason so they know why' });
  }
});
