import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import {
  organiserRequestBodySchema, organiserRequestIdSchema, organiserDecisionBodySchema,
} from '../schemas/organiserRequestSchemas.js';
import { alertAdminsToReview } from '../services/adminReviewAlerts.js';
import { sendOrganiserRequestOutcome } from '../utils/emailService.js';

// Event organiser access — docs/event-organiser-access.md.
//
// A member asks to manage an organiser page; an admin confirms them; approval
// makes them the OWNER of an `event_organisers` row, which RLS then lets them
// edit (logo, description, links — never name/slug/owner). Requests are written
// here with the service role: the table has no browser write policy.

const router = Router();

const APP_URL = () => (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/+$/, '');
const REQUEST_COLUMNS = 'id, user_id, organiser_name, organiser_id, website_url, message, status, decision_note, reviewed_at, created_at';
const ORGANISER_COLUMNS = 'id, name, slug, logo_url, owner_id';

const organiserUrl = (org) => (org?.slug ? `${APP_URL()}/events/organisers/${encodeURIComponent(org.slug)}` : null);
const isUniqueViolation = (err) => err?.code === '23505';

async function ownedOrganiser(userId) {
  const { data, error } = await supabase
    .from('event_organisers').select(ORGANISER_COLUMNS).eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function createRequest(user, { organiserName, websiteUrl, message, organiserId }) {
  const { data, error } = await supabase
    .from('organiser_requests')
    .insert({
      user_id: user.id,
      organiser_name: organiserName,
      organiser_id: organiserId || null,
      website_url: websiteUrl || null,
      message: message || null,
    })
    .select(REQUEST_COLUMNS)
    .single();
  if (error) throw error;

  const applicant = user.user_metadata?.full_name || user.email || 'A member';
  // Best-effort: the request is saved, so a failed bell/email is only logged.
  await alertAdminsToReview({
    type: 'organiser_request',
    title: 'New organiser request',
    body: `${applicant} asked to manage the organiser page for ${organiserName}.`,
    path: '/admin/organiser-requests',
    relatedId: data.id,
    email: {
      subject: `Organiser request: ${organiserName}`,
      intro: `${applicant} says they run ${organiserName} and wants to manage its organiser page. Check they are who they say, then approve or decline.`,
      rows: [
        ['Member', applicant],
        ['Email', user.email || ''],
        ['Organiser', organiserName],
        ['Website / social', websiteUrl || ''],
        ['Message', message || ''],
      ],
    },
  });
  return data;
}

/**
 * GET /organiser-requests/me — the caller's latest request and the organiser
 * page they own (if any). Drives the card in Account → My Events.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [{ data: requests, error }, organiser] = await Promise.all([
      supabase.from('organiser_requests').select(REQUEST_COLUMNS)
        .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(1),
      ownedOrganiser(req.user.id),
    ]);
    if (error) throw error;
    res.json({ request: requests?.[0] || null, organiser: organiser || null });
  } catch (err) {
    logger.error(`[ORGANISER_REQ] me failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load your organiser status' });
  }
});

/**
 * POST /organiser-requests — ask to manage an organiser page. Needs a
 * confirmed email so an admin has a real address to reach them on.
 */
router.post('/', authMiddleware, validateRequestBody(organiserRequestBodySchema), async (req, res) => {
  try {
    if (!req.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Confirm your email address first, then send your request.' });
    }
    if (await ownedOrganiser(req.user.id)) {
      return res.status(409).json({ error: 'You already manage an organiser page.' });
    }
    const { organiserId } = req.body;
    if (organiserId) {
      const { data: org, error } = await supabase
        .from('event_organisers').select('id, owner_id').eq('id', organiserId).maybeSingle();
      if (error) throw error;
      if (!org) return res.status(400).json({ error: 'That organiser page no longer exists.' });
      if (org.owner_id) return res.status(409).json({ error: 'That organiser page already has an owner. Contact CardPop if that is wrong.' });
    }
    const request = await createRequest(req.user, req.body);
    res.status(201).json({ request });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'You already have a request waiting for review.' });
    }
    logger.error(`[ORGANISER_REQ] create failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to send your request' });
  }
});

/**
 * POST /organiser-requests/from-signup — turns the "I'm an event organiser"
 * choice made on the sign-up form (kept in the account's metadata, because the
 * member has no session until they confirm their email) into a request, the
 * first time they are signed in with a confirmed email. Never re-creates one
 * after a decision: it only acts for an account with no request at all.
 */
router.post('/from-signup', authMiddleware, async (req, res) => {
  try {
    const meta = req.user.user_metadata || {};
    if (meta.organiser_interest !== true || !req.user.email_confirmed_at) {
      return res.json({ created: false });
    }
    const name = typeof meta.organiser_name === 'string' ? meta.organiser_name.trim().slice(0, 120) : '';
    if (name.length < 2) return res.json({ created: false });

    const [{ count, error }, owned] = await Promise.all([
      supabase.from('organiser_requests').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id),
      ownedOrganiser(req.user.id),
    ]);
    if (error) throw error;
    if (count > 0 || owned) return res.json({ created: false });

    const request = await createRequest(req.user, { organiserName: name });
    res.status(201).json({ created: true, request });
  } catch (err) {
    if (isUniqueViolation(err)) return res.json({ created: false });
    logger.error(`[ORGANISER_REQ] from-signup failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to record your organiser request' });
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * GET /organiser-requests/admin — every request with the applicant's account
 * details (contact email is service-role only) and the directory entries that
 * look like a match, so the admin can link rather than duplicate.
 */
router.get('/admin', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('organiser_requests').select(REQUEST_COLUMNS)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw error;

    const userIds = [...new Set((requests || []).map((r) => r.user_id))];
    const [{ data: profiles, error: pErr }, { data: organisers, error: oErr }] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, email, display_name, username').in('id', userIds)
        : Promise.resolve({ data: [] }),
      supabase.from('event_organisers').select(ORGANISER_COLUMNS).order('name').limit(500),
    ]);
    if (pErr) throw pErr;
    if (oErr) throw oErr;

    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    res.json({
      requests: (requests || []).map((r) => ({
        ...r,
        applicant: byId[r.user_id]
          ? { email: byId[r.user_id].email, name: byId[r.user_id].display_name, username: byId[r.user_id].username }
          : null,
      })),
      organisers: organisers || [],
    });
  } catch (err) {
    logger.error(`[ORGANISER_REQ] admin list failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load organiser requests' });
  }
});

/**
 * PATCH /organiser-requests/admin/:id — approve or decline.
 *
 * Approve links the applicant as owner of an existing directory entry
 * (`organiserId`) or of one created from the name they gave (reusing an
 * unowned entry with that exact name rather than duplicating it). The request
 * is claimed first (`status = 'pending'`) so two admins can't both decide it.
 */
router.patch(
  '/admin/:id',
  authMiddleware,
  requireAdmin,
  validateRequestParams(organiserRequestIdSchema),
  validateRequestBody(organiserDecisionBodySchema),
  async (req, res) => {
    const { action, note, organiserId } = req.body;
    try {
      const { data: request, error } = await supabase
        .from('organiser_requests').select(REQUEST_COLUMNS).eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.status !== 'pending') {
        return res.status(409).json({ error: `This request was already ${request.status}.` });
      }

      let organiser = null;
      if (action === 'approve') {
        if (await ownedOrganiser(request.user_id)) {
          return res.status(409).json({ error: 'This member already manages an organiser page.' });
        }
        const targetId = organiserId || request.organiser_id;
        if (targetId) {
          const { data, error: e } = await supabase
            .from('event_organisers').select(ORGANISER_COLUMNS).eq('id', targetId).maybeSingle();
          if (e) throw e;
          organiser = data;
          if (!organiser) return res.status(400).json({ error: 'That organiser page no longer exists.' });
        } else {
          const { data: same, error: e } = await supabase
            .from('event_organisers').select(ORGANISER_COLUMNS).ilike('name', request.organiser_name.trim()).limit(5);
          if (e) throw e;
          organiser = (same || []).find((o) => o.name.trim().toLowerCase() === request.organiser_name.trim().toLowerCase()) || null;
        }
        if (organiser?.owner_id && organiser.owner_id !== request.user_id) {
          return res.status(409).json({ error: `${organiser.name} already has an owner. Pick a different page or decline.` });
        }
      }

      // Claim the decision before acting on it.
      const { data: claimed, error: claimErr } = await supabase
        .from('organiser_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
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

      if (action === 'approve') {
        try {
          if (organiser) {
            const { error: e } = await supabase
              .from('event_organisers').update({ owner_id: request.user_id }).eq('id', organiser.id);
            if (e) throw e;
            organiser = { ...organiser, owner_id: request.user_id };
          } else {
            const { data, error: e } = await supabase
              .from('event_organisers')
              .insert({ name: request.organiser_name.trim(), owner_id: request.user_id, website_url: request.website_url })
              .select(ORGANISER_COLUMNS)
              .single();
            if (e) throw e;
            organiser = data;
          }
          await supabase.from('organiser_requests').update({ organiser_id: organiser.id }).eq('id', request.id);
        } catch (e) {
          // Put the request back so the admin can try again.
          await supabase.from('organiser_requests')
            .update({ status: 'pending', reviewed_by: null, reviewed_at: null, decision_note: null })
            .eq('id', request.id);
          throw e;
        }
      }

      // Tell the member — bell + email, both best-effort.
      const approved = action === 'approve';
      const pageUrl = approved ? organiserUrl(organiser) : null;
      try {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          type: approved ? 'organiser_approved' : 'organiser_rejected',
          title: approved ? 'You’re confirmed as an organiser' : 'Organiser request not approved',
          body: approved
            ? `You can now edit the organiser page for ${organiser.name}.`
            : (note || `We couldn’t confirm you as the organiser of ${request.organiser_name}.`),
          link: approved && organiser?.slug ? `/events/organisers/${organiser.slug}` : '/account/events',
          related_id: request.id,
        });
      } catch (e) {
        logger.warn(`[ORGANISER_REQ] bell failed: ${e.message}`);
      }
      try {
        const { data: profile } = await supabase
          .from('profiles').select('email, display_name, username').eq('id', request.user_id).maybeSingle();
        if (profile?.email) {
          await sendOrganiserRequestOutcome({
            to: profile.email,
            name: profile.display_name || profile.username,
            organiserName: approved ? organiser.name : request.organiser_name,
            approved, note, pageUrl,
          });
        }
      } catch (e) {
        logger.warn(`[ORGANISER_REQ] email failed: ${e.message}`);
      }

      logger.info(`[ORGANISER_REQ] ${req.user.id} ${action}d request ${request.id} for ${request.user_id}`);
      res.json({ ok: true, status: approved ? 'approved' : 'rejected', organiser });
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'That organiser page or member is already linked.' });
      logger.error(`[ORGANISER_REQ] decision failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to record the decision' });
    }
  },
);

export default router;
