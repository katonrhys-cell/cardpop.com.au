import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import {
  storeOwnerRequestBodySchema, storeOwnerRequestIdSchema, storeOwnerDecisionBodySchema,
} from '../schemas/storeOwnerRequestSchemas.js';
import { alertAdminsToReview } from '../services/adminReviewAlerts.js';
import { sendStoreOwnerRequestOutcome } from '../utils/emailService.js';

// Card shop ownership — docs/store-pages.md → "Shop owners".
//
// A member asks to own a shop page CardPop already lists; an admin confirms
// them; approval makes them the OWNER of that `local_game_stores` row, which
// RLS then lets them edit (details, hours, logo, photos, videos — never the
// name, slug, city, status or owner). Requests are written here with the
// service role: the table has no browser write policy. The organiser twin of
// this file is organiser-requests.js.

const router = Router();

const APP_URL = () => (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/+$/, '');
const REQUEST_COLUMNS = 'id, user_id, store_id, role_title, website_url, message, status, decision_note, reviewed_at, created_at';
const STORE_COLUMNS = 'id, slug, name, suburb, city, state, status, owner_id';

const storePagePath = (store) => (store?.slug && store?.city
  ? `/card-shops/${encodeURIComponent(store.city)}/${encodeURIComponent(store.slug)}`
  : null);
const isUniqueViolation = (err) => err?.code === '23505';

async function storesById(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase.from('local_game_stores').select(STORE_COLUMNS).in('id', ids);
  if (error) throw error;
  return Object.fromEntries((data || []).map((s) => [s.id, s]));
}

/**
 * GET /store-owner-requests/me — the caller's requests (newest first, with the
 * shop each is for) and the shops they own. Drives the card in Account → My
 * Events and the owner's Edit button on a shop page.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [{ data: requests, error }, { data: stores, error: sErr }] = await Promise.all([
      supabase.from('store_owner_requests').select(REQUEST_COLUMNS)
        .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('local_game_stores').select(STORE_COLUMNS).eq('owner_id', req.user.id).order('name'),
    ]);
    if (error) throw error;
    if (sErr) throw sErr;
    const byId = await storesById([...new Set((requests || []).map((r) => r.store_id))]);
    res.json({
      requests: (requests || []).map((r) => ({ ...r, store: byId[r.store_id] || null })),
      stores: stores || [],
    });
  } catch (err) {
    logger.error(`[STORE_OWNER_REQ] me failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load your shop ownership status' });
  }
});

/**
 * POST /store-owner-requests — ask to own a listed shop's page. Needs a
 * confirmed email so an admin has a real address to reach them on.
 */
router.post('/', authMiddleware, validateRequestBody(storeOwnerRequestBodySchema), async (req, res) => {
  try {
    if (!req.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Confirm your email address first, then send your request.' });
    }
    const { storeId, roleTitle, websiteUrl, message } = req.body;
    const { data: store, error: storeErr } = await supabase
      .from('local_game_stores').select(STORE_COLUMNS).eq('id', storeId).maybeSingle();
    if (storeErr) throw storeErr;
    if (!store || store.status !== 'approved') {
      return res.status(400).json({ error: 'That shop is not in the directory.' });
    }
    if (store.owner_id === req.user.id) {
      return res.status(409).json({ error: 'You already manage this shop page.' });
    }
    if (store.owner_id) {
      return res.status(409).json({ error: 'That shop page already has an owner. Contact CardPop if that is wrong.' });
    }

    const { data, error } = await supabase
      .from('store_owner_requests')
      .insert({
        user_id: req.user.id,
        store_id: store.id,
        role_title: roleTitle,
        website_url: websiteUrl,
        message,
      })
      .select(REQUEST_COLUMNS)
      .single();
    if (error) throw error;

    const applicant = req.user.user_metadata?.full_name || req.user.email || 'A member';
    const where = [store.suburb, store.state].filter(Boolean).join(', ');
    // Best-effort: the request is saved, so a failed bell/email is only logged.
    await alertAdminsToReview({
      type: 'store_owner_request',
      title: 'New shop owner request',
      body: `${applicant} asked to manage the shop page for ${store.name}${where ? ` (${where})` : ''}.`,
      path: '/admin/store-directory',
      relatedId: data.id,
      email: {
        subject: `Shop owner request: ${store.name}`,
        intro: `${applicant} says they run ${store.name} and wants to manage its page in the card shop directory. Check they are who they say, then approve or decline.`,
        rows: [
          ['Member', applicant],
          ['Email', req.user.email || ''],
          ['Shop', `${store.name}${where ? ` — ${where}` : ''}`],
          ['Their role', roleTitle || ''],
          ['Website / social', websiteUrl || ''],
          ['Message', message || ''],
        ],
      },
    });
    res.status(201).json({ request: { ...data, store } });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'You already have a request for this shop waiting for review.' });
    }
    logger.error(`[STORE_OWNER_REQ] create failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to send your request' });
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * GET /store-owner-requests/admin — every request with the shop it is for and
 * the applicant's account details (contact email is service-role only).
 */
router.get('/admin', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('store_owner_requests').select(REQUEST_COLUMNS)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw error;

    const userIds = [...new Set((requests || []).map((r) => r.user_id))];
    const [{ data: profiles, error: pErr }, byStore] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, email, display_name, username').in('id', userIds)
        : Promise.resolve({ data: [] }),
      storesById([...new Set((requests || []).map((r) => r.store_id))]),
    ]);
    if (pErr) throw pErr;

    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    res.json({
      requests: (requests || []).map((r) => ({
        ...r,
        store: byStore[r.store_id] || null,
        applicant: byId[r.user_id]
          ? { email: byId[r.user_id].email, name: byId[r.user_id].display_name, username: byId[r.user_id].username }
          : null,
      })),
    });
  } catch (err) {
    logger.error(`[STORE_OWNER_REQ] admin list failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load shop owner requests' });
  }
});

/**
 * PATCH /store-owner-requests/admin/:id — approve or decline. The request is
 * claimed first (`status = 'pending'`) so two admins can't both decide it;
 * approving sets the shop's owner only while it still has none.
 */
router.patch(
  '/admin/:id',
  authMiddleware,
  requireAdmin,
  validateRequestParams(storeOwnerRequestIdSchema),
  validateRequestBody(storeOwnerDecisionBodySchema),
  async (req, res) => {
    const { action, note } = req.body;
    const approved = action === 'approve';
    try {
      const { data: request, error } = await supabase
        .from('store_owner_requests').select(REQUEST_COLUMNS).eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.status !== 'pending') {
        return res.status(409).json({ error: `This request was already ${request.status}.` });
      }

      const { data: store, error: storeErr } = await supabase
        .from('local_game_stores').select(STORE_COLUMNS).eq('id', request.store_id).maybeSingle();
      if (storeErr) throw storeErr;
      if (approved) {
        if (!store) return res.status(400).json({ error: 'That shop is no longer in the directory.' });
        if (store.owner_id && store.owner_id !== request.user_id) {
          return res.status(409).json({ error: `${store.name} already has an owner. Decline this request, or remove the current owner first.` });
        }
      }

      // Claim the decision before acting on it.
      const { data: claimed, error: claimErr } = await supabase
        .from('store_owner_requests')
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

      if (approved) {
        const { error: ownErr } = await supabase
          .from('local_game_stores')
          .update({ owner_id: request.user_id, updated_at: new Date().toISOString() })
          .eq('id', store.id);
        if (ownErr) {
          // Put the request back so the admin can try again.
          await supabase.from('store_owner_requests')
            .update({ status: 'pending', reviewed_by: null, reviewed_at: null, decision_note: null })
            .eq('id', request.id);
          throw ownErr;
        }
      }

      // Tell the member — bell + email, both best-effort.
      const shopName = store?.name || 'the shop';
      const path = storePagePath(store);
      try {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          type: approved ? 'store_owner_approved' : 'store_owner_rejected',
          title: approved ? 'You’re confirmed as the shop’s owner' : 'Shop owner request not approved',
          body: approved
            ? `You can now edit the page for ${shopName}.`
            : (note || `We couldn’t confirm you as the owner of ${shopName}.`),
          link: approved && path ? path : '/account/events',
          related_id: request.id,
        });
      } catch (e) {
        logger.warn(`[STORE_OWNER_REQ] bell failed: ${e.message}`);
      }
      try {
        const { data: profile } = await supabase
          .from('profiles').select('email, display_name, username').eq('id', request.user_id).maybeSingle();
        if (profile?.email) {
          await sendStoreOwnerRequestOutcome({
            to: profile.email,
            name: profile.display_name || profile.username,
            storeName: shopName,
            approved,
            note,
            pageUrl: approved && path ? `${APP_URL()}${path}` : null,
          });
        }
      } catch (e) {
        logger.warn(`[STORE_OWNER_REQ] email failed: ${e.message}`);
      }

      logger.info(`[STORE_OWNER_REQ] ${req.user.id} ${action}d request ${request.id} for ${request.user_id}`);
      res.json({ ok: true, status: approved ? 'approved' : 'rejected', store: approved ? { ...store, owner_id: request.user_id } : store });
    } catch (err) {
      logger.error(`[STORE_OWNER_REQ] decision failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to record the decision' });
    }
  },
);

/**
 * DELETE /store-owner-requests/admin/owner/:id — take a shop page back from
 * its owner (`:id` is the shop). The page and everything on it stay.
 */
router.delete(
  '/admin/owner/:id',
  authMiddleware,
  requireAdmin,
  validateRequestParams(storeOwnerRequestIdSchema),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('local_game_stores')
        .update({ owner_id: null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: 'Shop not found' });
      logger.info(`[STORE_OWNER_REQ] ${req.user.id} removed the owner of shop ${req.params.id}`);
      res.json({ ok: true });
    } catch (err) {
      logger.error(`[STORE_OWNER_REQ] remove owner failed: ${err.message}`);
      res.status(500).json({ error: 'Failed to remove the owner' });
    }
  },
);

export default router;
