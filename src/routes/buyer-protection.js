import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client for backend
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:8000',
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Get user's claims
router.get('/my-claims', async (req, res) => {
  try {
    const userId = req.user?.id; // Assuming auth middleware sets req.user
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: claims, error } = await supabase
      .from('buyer_protection_claims')
      .select('*, order:orders(id, created_at, total_amount)')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(claims || []);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Create a new claim
router.post('/', async (req, res) => {
  try {
    const { order_id, claim_type, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!order_id || !claim_type || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate claim type
    const validTypes = ['item_not_received', 'item_not_as_described', 'damaged', 'other'];
    if (!validTypes.includes(claim_type)) {
      return res.status(400).json({ error: 'Invalid claim type' });
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
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// Update claim status (admin only)
router.put('/:claimId/status', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, resolution, refund_amount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate status
    const validStatuses = ['pending', 'investigating', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if user is admin (you may need to implement admin check)
    // For now, we'll skip admin check for development

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
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Get claim details
router.get('/:claimId', async (req, res) => {
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
      .single();

    if (error) throw error;

    // Check if user is involved in the claim
    if (claim.buyer_id !== userId && claim.seller_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(claim);
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

export default router;
