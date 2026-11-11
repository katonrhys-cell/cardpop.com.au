import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import {
  playerRequestBodySchema, playerRequestIdSchema, playerRequestDecisionSchema,
} from '../schemas/playerRequestSchemas.js';
import { alertAdminsToReview } from '../services/adminReviewAlerts.js';
import { playerSlug, matchPlayers } from '../../utils/players.js';

// Player requests — docs/players.md → Player requests.
//
// A member can't find an athlete in the card form's Player picker and asks for
// them. Every admin is belled + emailed; an admin confirms the person is real
// and approval creates an UNPUBLISHED draft player to write up and publish at
// Admin → Players. Requests are written here with the service role — the table
// has no browser write policy.

const router = Router();

const REQUEST_COLUMNS = 'id, user_id, name, sport, team, reference_url, note, status, decision_note, player_id, reviewed_at, created_at';
const PLAYER_LITE = 'id, slug, name, sport, team, is_published, aliases';
const MAX_PENDING_PER_MEMBER = 5;
const isUniqueViolation = (err) => err?.code === '23505';

/**
 * POST /player-requests — ask for a player to be added. Needs a confirmed email
 * so an admin has a real address to reach them on.
 */
router.post('/', authMiddleware, validateRequestBody(playerRequestBodySchema), async (req, res) => {
  try {
    if (!req.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Confirm your email address first, then ask for the player.' });
    }
    const { name, sport, team, referenceUrl, note } = req.body;

    // Already in the catalogue? Point them at it instead of queueing a duplicate.
    const { data: existing, error: exErr } = await supabase
      .from('players').select(PLAYER_LITE).eq('is_published', true).limit(2000);
    if (exErr) throw exErr;
    const slug = playerSlug(name);
    const dupe = (existing || []).find((p) => p.slug === slug)
      || matchPlayers(existing || [], name, 1).find((p) => playerSlug(p.name) === slug);
    if (dupe) {
      return res.status(409).json({ error: `${dupe.name} is already in the list — search for them in the Player field.`, player: dupe });
    }

    const { count, error: cErr } = await supabase
      .from('player_requests').select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('status', 'pending');
    if (cErr) throw cErr;
    if ((count || 0) >= MAX_PENDING_PER_MEMBER) {
      return res.status(429).json({ error: 'You have several requests waiting already. We’ll get through them soon.' });
    }

    const { data, error } = await supabase
      .from('player_requests')
      .insert({
        user_id: req.user.id, name, sport, team, reference_url: referenceUrl, note,
      })
      .select(REQUEST_COLUMNS)
      .single();
    if (error) throw error;

    const applicant = req.user.user_metadata?.full_name || req.user.email || 'A member';
    // Best-effort: the request is saved, so a failed bell/email is only logged.
    await alertAdminsToReview({
      type: 'player_request',
      title: 'New player request',
      body: `${applicant} asked for ${name} (${sport}) to be added as a player.`,
      path: '/admin/players',
      relatedId: data.id,
      email: {
        subject: `Player request: ${name} (${sport})`,
        intro: `${applicant} couldn’t find ${name} in the Player picker. Check they are a real athlete, then approve (creates a draft page for you to finish and publish) or decline.`,
        rows: [
          ['Member', applicant],
          ['Email', req.user.email || ''],
          ['Player', name],
          ['Sport', sport],
          ['Team', team || ''],
          ['Where to confirm', referenceUrl || ''],
          ['Note', note || ''],
        ],
      },
    });

    res.status(201).json({ request: data });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'You already asked for that player — we’ll let you know once we’ve checked.' });
    }
    logger.error(`[PLAYER_REQ] create failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to send your request' });
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

/** GET /player-requests/admin — requests with the applicant's contact details. */
router.get('/admin', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('player_requests').select(REQUEST_COLUMNS)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw error;

    const userIds = [...new Set((requests || []).map((r) => r.user_id))];
    const { data: profiles, error: pErr } = userIds.length
      ? await supabase.from('profiles').select('id, email, display_name, username').in('id', userIds)
      : { data: [] };
    if (pErr) throw pErr;

    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    res.json({
      requests: (requests || []).map((r) => ({
        ...r,
        applicant: byId[r.user_id]
          ? { email: byId[r.user_id].email, name: byId[r.user_id].display_name, username: byId[r.user_id].username }
          : null,
      })),
    });
  } catch (err) {
    logger.error(`[PLAYER_REQ] admin list failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load player requests' });
  }
});

/**
 * PATCH /player-requests/admin/:id — approve or decline.
 *
 * Approve confirms the athlete is real: it creates an unpublished draft player
 * (or links `playerId`, an existing one) for the admin to finish at Admin →
 * Players. Declining needs a reason. The request is claimed first
 * (`status = 'pending'`) so two admins can't both decide it.
 */
router.patch(
  '/admin/:id',
  authMiddleware,
  requireAdmin,
  validateRequestParams(playerRequestIdSchema),
  validateRequestBody(playerRequestDecisionSchema),
  async (req, res) => {
    const { action, note, playerId } = req.body;
    try {
      const { data: request, error } = await supabase
        .from('player_requests').select(REQUEST_COLUMNS).eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.status !== 'pending') {
        return res.status(409).json({ error: `This request was already ${request.status}.` });
      }
      const approved = action === 'approve';

      let linked = null;
      if (approved && playerId) {
        const { data, error: e } = await supabase.from('players').select(PLAYER_LITE).eq('id', playerId).maybeSingle();
        if (e) throw e;
        if (!data) return res.status(400).json({ error: 'That player no longer exists.' });
        linked = data;
      }

      const { data: claimed, error: claimErr } = await supabase
        .from('player_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          decision_note: note || null,
          reviewed_by: req.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .eq('status', 'pending')
        .select('id');
      if (claimErr) throw claimErr;
      if (!claimed?.length) return res.status(409).json({ error: 'This request was just decided by someone else.' });

      let player = linked;
      if (approved && !player) {
        try {
          const slug = playerSlug(request.name);
          const { data: same, error: e } = await supabase
            .from('players').select(PLAYER_LITE).eq('slug', slug).maybeSingle();
          if (e) throw e;
          if (same) {
            player = same;
          } else {
            const { data, error: insErr } = await supabase
              .from('players')
              .insert({
                slug, name: request.name.trim(), sport: request.sport, team: request.team || null,
                is_published: false, sort_order: 500,
              })
              .select(PLAYER_LITE)
              .single();
            if (insErr) throw insErr;
            player = data;
          }
        } catch (e) {
          // Put the request back so the admin can try again.
          await supabase.from('player_requests')
            .update({ status: 'pending', reviewed_by: null, reviewed_at: null, decision_note: null })
            .eq('id', request.id);
          throw e;
        }
      }
      if (player) {
        await supabase.from('player_requests').update({ player_id: player.id }).eq('id', request.id);
      }

      // Tell the member — best-effort bell.
      try {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          type: approved ? 'player_request_approved' : 'player_request_rejected',
          title: approved ? `${request.name} is confirmed` : 'Player request not approved',
          body: approved
            ? `Thanks — we’ve confirmed ${request.name}. Their page is being set up and you’ll be able to tag them on your cards once it’s live.`
            : (note || `We couldn’t confirm ${request.name} as a player to add.`),
          link: '/account',
          related_id: request.id,
        });
      } catch (e) {
        logger.warn(`[PLAYER_REQ] bell failed: ${e.message}`);
      }

      logger.info(`[PLAYER_REQ] ${req.user.id} ${action}d request ${request.id} for ${request.user_id}`);
      res.json({ ok: true, status: approved ? 'approved' : 'rejected', player });
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'A player with that name already exists.' });
      logger.error(`[PLAYER_REQ] decision failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to record the decision' });
    }
  },
);

export default router;
