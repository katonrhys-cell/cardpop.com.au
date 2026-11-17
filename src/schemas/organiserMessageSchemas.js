import { z } from 'zod';
import {
  ORGANISER_MESSAGE_TOPIC_VALUES, ORGANISER_MESSAGE_MIN, ORGANISER_MESSAGE_MAX,
} from '../../utils/organiserMessages.js';

export const organiserMessageBodySchema = z.object({
  organiserId: z.string().uuid('Unknown organiser'),
  topic: z.enum(ORGANISER_MESSAGE_TOPIC_VALUES),
  message: z.string().trim()
    .min(ORGANISER_MESSAGE_MIN, `Write at least ${ORGANISER_MESSAGE_MIN} characters`)
    .max(ORGANISER_MESSAGE_MAX, `Keep it under ${ORGANISER_MESSAGE_MAX} characters`),
});

export const organiserMessageIdSchema = z.object({
  id: z.string().uuid('Invalid message id'),
});

export const organiserMessageDecisionSchema = z.object({
  action: z.enum(['release', 'dismiss']),
});
