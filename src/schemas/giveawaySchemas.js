import { z } from 'zod';
import { AU_STATES, GIVEAWAY_STATUSES } from '../../utils/giveaway.js';

const handle = z.string().trim().min(1).max(31);

export const giveawaySlugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid giveaway').max(80),
});

export const giveawayIdSchema = z.object({
  id: z.string().uuid('Invalid giveaway id'),
});

export const giveawayEntryIdSchema = z.object({
  id: z.string().uuid('Invalid giveaway id'),
  entryId: z.string().uuid('Invalid entry id'),
});

export const enterGiveawayBodySchema = z.object({
  instagramHandle: handle,
  prizeKey: z.string().trim().max(60).optional().nullable(),
  state: z.enum(AU_STATES, { errorMap: () => ({ message: 'Pick your state or territory' }) }),
  postcode: z.string().trim().regex(/^[0-9]{4}$/, 'Enter a 4-digit Australian postcode'),
  residentConfirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm you live in Australia' }) }),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm you are old enough to enter' }) }),
  newsletterOptIn: z.boolean().optional().default(false),
  // Hidden honeypot — a filled value means a bot.
  company: z.string().max(200).optional(),
});

const prizeSchema = z.object({
  key: z.string().trim().max(60).optional(),
  label: z.string().trim().min(1).max(80),
  detail: z.string().trim().max(160).optional().nullable(),
  image_url: z.string().trim().max(500).optional().nullable(),
});

const isoDate = z.string().datetime({ offset: true });

export const createGiveawayBodySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug: lower-case letters, digits and hyphens').max(80),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  imageUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal('')),
  prizes: z.array(prizeSchema).max(12).default([]),
  entryMode: z.enum(['pick_prize', 'single_prize']).default('pick_prize'),
  instagramPostUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal('')),
  opensAt: isoDate,
  closesAt: isoDate,
  status: z.enum(GIVEAWAY_STATUSES).default('draft'),
  terms: z.string().trim().max(8000).optional().nullable(),
  minAge: z.number().int().min(0).max(21).default(18),
}).refine((b) => new Date(b.closesAt) > new Date(b.opensAt), { message: 'Close must be after open', path: ['closesAt'] })
  .refine((b) => b.entryMode === 'single_prize' ? b.prizes.length >= 1 : b.prizes.length >= 2, { message: 'Add the prizes on offer', path: ['prizes'] });

export const updateGiveawayBodySchema = createGiveawayBodySchema;

export const verifyEntryBodySchema = z.object({
  verified: z.boolean(),
});

export const drawGiveawayBodySchema = z.object({
  // 'verified' = only entries an admin has ticked as found under the post;
  // 'all' = every entry.
  pool: z.enum(['verified', 'all']).default('verified'),
});
