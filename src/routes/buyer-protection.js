import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import { createClaimSchema, getClaimSchema, updateClaimStatusParamsSchema, updateClaimStatusBodySchema } from '../schemas/buyerProtectionSchemas.js';

const router = Router();

// Every buyer-protection endpoint operates on the authenticated user's claims,
// so require a valid Bearer token for all routes (fails closed at the gate).
router.use(authMiddleware);

// Get user's claims
router.get('/my-claims', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: claims, error } = await supabase
      .from('buyer_protection_claims')
      .select('*, order:orders(id, created_at, total_aud)')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(claims || []);
  } catch (error) {
    logger.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Create a new claim
router.post('/', validateRequestBody(createClaimSchema), async (req, res) => {
  try {
    const { order_id, claim_type, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('seller_id, buyer_id, created_at')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify user is the buyer
    if (order.buyer_id !== userId) {
      return res.status(403).json({ error: 'You can only create claims for your own orders' });
    }

    // Check if claim already exists for this order
    const { data: existingClaim } = await supabase
      .from('buyer_protection_claims')
      .select('id')
      .eq('order_id', order_id)
      .single();

    if (existingClaim) {
      return res.status(400).json({ error: 'A claim already exists for this order' });
    }

    // Create the claim
    const { data: claim, error: createError } = await supabase
      .from('buyer_protection_claims')
      .insert({
        order_id,
        buyer_id: userId,
        seller_id: order.seller_id,
        claim_type,
        description,
        status: 'pending'
      })
      .select()
      .single();

    if (createError) throw createError;

    res.status(201).json(claim);
  } catch (error) {
    logger.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// Update claim status (admin only)
router.put('/:claimId/status', validateRequestParams(updateClaimStatusParamsSchema), validateRequestBody(updateClaimStatusBodySchema), async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, resolution, refund_amount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Resolving/rejecting claims and setting refund amounts is an admin-only
    // action. Trust the server-controlled JWT app_metadata, never the body.
    if (!(await isAdminUser(req))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'resolved') {
      updateData.resolution = resolution;
      updateData.refund_amount = refund_amount;
      updateData.resolved_at = new Date().toISOString();
    }

    const { data: claim, error } = await supabase
      .from('buyer_protection_claims')
      .update(updateData)
      .eq('id', claimId)
      .select()
      .single();

    if (error) throw error;

    res.json(claim);
  } catch (error) {
    logger.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Get claim details
router.get('/:claimId', validateRequestParams(getClaimSchema), async (req, res) => {
  try {
    const { claimId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: claim, error } = await supabase
      .from('buyer_protection_claims')
      .select('*, order:orders(*), seller:profiles(display_name, username), buyer:profiles(display_name, username)')
      .eq('id', claimId)
      .maybeSingle();

    if (error) throw error;
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    // Check if user is involved in the claim
    if (claim.buyer_id !== userId && claim.seller_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(claim);
  } catch (error) {
    logger.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

export default router;
