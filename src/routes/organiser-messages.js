import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import {
  organiserMessageBodySchema, organiserMessageIdSchema, organiserMessageDecisionSchema,
} from '../schemas/organiserMessageSchemas.js';
import { alertAdminsToReview } from '../services/adminReviewAlerts.js';
import { sendOrganiserMessage } from '../utils/emailService.js';
import { scanOrganiserMessage } from '../utils/organiserMessageScan.js';
import {
  organiserMessageTopicLabel,
  ORGANISER_MESSAGE_DAILY_LIMIT, ORGANISER_MESSAGE_DAILY_LIMIT_PER_ORGANISER,
} from '../../utils/organiserMessages.js';

// Messages to event organisers — docs/organiser-messages.md.
//
// A signed-in member with a confirmed email writes to an organiser from the
// organiser's page. This route is the only writer of `organiser_messages` (the
// table has no browser policy), so it is the one place every message is
// screened: a clean message goes to the page's owner, or to the CardPop admins
// when nobody has claimed the page; anything the screen flags, or could not
// check, is held for an admin and reaches nobody until they release it.
//
// The sender always gets the same answer, whatever the screen decided — telling
// someone their message was flagged teaches them how to word the next one.

const router = Router();

const APP_URL = () => (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/+$/, '');
const ADMIN_PATH = '/admin/organiser-messages';
const ORGANISER_COLUMNS = 'id, name, slug, owner_id';
const MESSAGE_COLUMNS = 'id, organiser_id, sender_id, sender_name, sender_email, topic, body, status, recipient_id, scan_verdict, scan_category, scan_reason, reviewed_at, created_at';
// What the organiser sees in their inbox — no screening detail.
const INBOX_COLUMNS = 'id, sender_name, sender_email, topic, body, created_at';

const organiserPath = (org) => `/events/organisers/${encodeURIComponent(org.slug)}`;
const excerpt = (text, max = 140) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

async function countSince(senderId, sinceIso, organiserId = null) {
  let query = supabase
    .from('organiser_messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', senderId)
    .gte('created_at', sinceIso);
  if (organiserId) query = query.eq('organiser_id', organiserId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Bell + email the page's owner. Best-effort: the message is already saved. */
async function deliverToOwner(message, organiser) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: organiser.owner_id,
      type: 'organiser_message',
      title: `New message from ${message.sender_name}`,
      body: `${organiserMessageTopicLabel(message.topic)}: ${excerpt(message.body)}`,
      link: `${organiserPath(organiser)}#messages`,
      related_id: message.id,
    });
    if (error) throw error;
  } catch (err) {
    logger.warn(`[ORGANISER_MSG] bell failed for ${message.id}: ${err.message}`);
  }
  try {
    const { data: owner } = await supabase
      .from('profiles').select('email, display_name, username').eq('id', organiser.owner_id).maybeSingle();
    if (owner?.email) {
      await sendOrganiserMessage({
        to: owner.email,
        ownerName: owner.display_name || owner.username,
        organiserName: organiser.name,
        senderName: message.sender_name,
        senderEmail: message.sender_email,
        topicLabel: organiserMessageTopicLabel(message.topic),
        message: message.body,
        inboxUrl: `${APP_URL()}${organiserPath(organiser)}#messages`,
      });
    }
  } catch (err) {
    logger.warn(`[ORGANISER_MSG] email failed for ${message.id}: ${err.message}`);
  }
}

const adminRows = (message, organiser, extra = []) => [
  ['Organiser', organiser.name],
  ['From', `${message.sender_name} (${message.sender_email})`],
  ['About', organiserMessageTopicLabel(message.topic)],
  ...extra,
  ['Message', message.body],
];

/**
 * POST /organiser-messages — send a message to an organiser.
 */
router.post('/', authMiddleware, validateRequestBody(organiserMessageBodySchema), async (req, res) => {
  const { organiserId, topic, message: body } = req.body;
  try {
    if (!req.user.email_confirmed_at || !req.user.email) {
      return res.status(403).json({ error: 'Confirm your email address first, then send your message.' });
    }

    const { data: organiser, error: orgErr } = await supabase
      .from('event_organisers').select(ORGANISER_COLUMNS).eq('id', organiserId).maybeSingle();
    if (orgErr) throw orgErr;
    if (!organiser) return res.status(404).json({ error: 'That organiser page no longer exists.' });
    if (organiser.owner_id === req.user.id) {
      return res.status(400).json({ error: 'This is your own organiser page.' });
    }

    // Limits count every message, held and dismissed ones included.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [toThisOrganiser, toAnyone] = await Promise.all([
      countSince(req.user.id, since, organiser.id),
      countSince(req.user.id, since),
    ]);
    if (toThisOrganiser >= ORGANISER_MESSAGE_DAILY_LIMIT_PER_ORGANISER) {
      return res.status(429).json({ error: `You can send ${organiser.name} ${ORGANISER_MESSAGE_DAILY_LIMIT_PER_ORGANISER} messages a day. Please try again tomorrow.` });
    }
    if (toAnyone >= ORGANISER_MESSAGE_DAILY_LIMIT) {
      return res.status(429).json({ error: 'You’ve reached today’s limit for messages to organisers. Please try again tomorrow.' });
    }

    const { data: profile } = await supabase
      .from('profiles').select('display_name, username').eq('id', req.user.id).maybeSingle();
    const senderName = String(
      profile?.display_name || profile?.username || req.user.user_metadata?.full_name || 'A CardPop member',
    ).trim().slice(0, 120);

    const scan = await scanOrganiserMessage({ body, topic, organiserName: organiser.name, userId: req.user.id });
    const isClean = scan.verdict === 'clean';
    const status = !isClean ? 'held' : organiser.owner_id ? 'delivered' : 'forwarded';

    const { data: saved, error: insErr } = await supabase
      .from('organiser_messages')
      .insert({
        organiser_id: organiser.id,
        sender_id: req.user.id,
        sender_name: senderName,
        sender_email: req.user.email,
        topic,
        body,
        status,
        recipient_id: status === 'delivered' ? organiser.owner_id : null,
        scan_verdict: scan.verdict,
        scan_category: scan.category,
        scan_reason: scan.reason,
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (insErr) throw insErr;

    if (status === 'delivered') {
      await deliverToOwner(saved, organiser);
    } else if (status === 'forwarded') {
      await alertAdminsToReview({
        type: 'organiser_message_review',
        title: `Message for ${organiser.name}`,
        body: `${senderName} wrote to ${organiser.name}, which has no linked organiser yet: ${excerpt(body)}`,
        path: ADMIN_PATH,
        relatedId: saved.id,
        email: {
          subject: `Message for ${organiser.name} (no organiser linked)`,
          intro: `${senderName} sent a message to ${organiser.name} from its organiser page. Nobody has claimed that page, so it has come to CardPop. Reply to the sender, or pass it on to the organiser if you have their details.`,
          rows: adminRows(saved, organiser),
        },
      });
    } else {
      await alertAdminsToReview({
        type: 'organiser_message_review',
        title: 'Organiser message held for review',
        body: `A message from ${senderName} to ${organiser.name} was held: ${scan.reason || 'it needs a person to check it'}`,
        path: ADMIN_PATH,
        relatedId: saved.id,
        email: {
          subject: `Held: message for ${organiser.name}`,
          intro: scan.verdict === 'flagged'
            ? `The automatic screen flagged a message to ${organiser.name}. The organiser has not seen it. Release it if it is fine, or dismiss it.`
            : `A message to ${organiser.name} could not be screened automatically, so it is waiting for you. The organiser has not seen it. Release it if it is fine, or dismiss it.`,
          rows: adminRows(saved, organiser, [
            ['Screen', scan.verdict === 'flagged' ? `Flagged (${scan.category || 'other'})` : 'Could not run'],
            ['Why', scan.reason || ''],
          ]),
        },
      });
    }

    logger.info(`[ORGANISER_MSG] ${req.user.id} → organiser ${organiser.id}: ${status} (${scan.verdict})`);
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error(`[ORGANISER_MSG] send failed: ${err.message}`);
    res.status(500).json({ error: 'We could not send your message. Please try again.' });
  }
});

/**
 * GET /organiser-messages/inbox — the messages delivered to the organiser page
 * the caller owns. Held and dismissed messages never appear here.
 */
router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const { data: organiser, error: orgErr } = await supabase
      .from('event_organisers').select(ORGANISER_COLUMNS).eq('owner_id', req.user.id).maybeSingle();
    if (orgErr) throw orgErr;
    if (!organiser) return res.json({ organiser: null, messages: [] });

    const { data: messages, error } = await supabase
      .from('organiser_messages')
      .select(INBOX_COLUMNS)
      .eq('organiser_id', organiser.id)
      .eq('recipient_id', req.user.id)
      .in('status', ['delivered', 'released'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ organiser: { id: organiser.id, name: organiser.name, slug: organiser.slug }, messages: messages || [] });
  } catch (err) {
    logger.error(`[ORGANISER_MSG] inbox failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load your messages' });
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * GET /organiser-messages/admin — every message, newest first, with the
 * organiser it was for and what the screen said.
 */
router.get('/admin', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from('organiser_messages').select(MESSAGE_COLUMNS)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw error;

    const organiserIds = [...new Set((messages || []).map((m) => m.organiser_id))];
    const { data: organisers, error: oErr } = organiserIds.length
      ? await supabase.from('event_organisers').select(ORGANISER_COLUMNS).in('id', organiserIds)
      : { data: [], error: null };
    if (oErr) throw oErr;

    const byId = Object.fromEntries((organisers || []).map((o) => [o.id, o]));
    res.json({
      messages: (messages || []).map((m) => ({
        ...m,
        organiser: byId[m.organiser_id]
          ? { name: byId[m.organiser_id].name, slug: byId[m.organiser_id].slug, hasOwner: Boolean(byId[m.organiser_id].owner_id) }
          : null,
      })),
    });
  } catch (err) {
    logger.error(`[ORGANISER_MSG] admin list failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load organiser messages' });
  }
});

/**
 * PATCH /organiser-messages/admin/:id — decide a held message.
 *
 * `release` passes it on: to the page's owner (bell + email), or, when the
 * page still has no owner, into the admins' own pile as `forwarded`.
 * `dismiss` closes it; nobody else ever sees it. The row is claimed first
 * (`status = 'held'`) so two admins can't both decide it.
 */
router.patch(
  '/admin/:id',
  authMiddleware,
  requireAdmin,
  validateRequestParams(organiserMessageIdSchema),
  validateRequestBody(organiserMessageDecisionSchema),
  async (req, res) => {
    const { action } = req.body;
    try {
      const { data: message, error } = await supabase
        .from('organiser_messages').select(MESSAGE_COLUMNS).eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!message) return res.status(404).json({ error: 'Message not found' });
      if (message.status !== 'held') {
        return res.status(409).json({ error: `This message was already ${message.status}.` });
      }

      let organiser = null;
      let status = 'dismissed';
      if (action === 'release') {
        const { data, error: oErr } = await supabase
          .from('event_organisers').select(ORGANISER_COLUMNS).eq('id', message.organiser_id).maybeSingle();
        if (oErr) throw oErr;
        organiser = data;
        status = organiser?.owner_id ? 'released' : 'forwarded';
      }

      const { data: claimed, error: claimErr } = await supabase
        .from('organiser_messages')
        .update({
          status,
          recipient_id: status === 'released' ? organiser.owner_id : null,
          reviewed_by: req.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', message.id)
        .eq('status', 'held')
        .select('id');
      if (claimErr) throw claimErr;
      if (!claimed?.length) return res.status(409).json({ error: 'This message was just decided by someone else.' });

      if (status === 'released') await deliverToOwner(message, organiser);

      logger.info(`[ORGANISER_MSG] ${req.user.id} ${action}d message ${message.id} → ${status}`);
      res.json({ ok: true, status });
    } catch (err) {
      logger.error(`[ORGANISER_MSG] decision failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to record the decision' });
    }
  },
);

export default router;
