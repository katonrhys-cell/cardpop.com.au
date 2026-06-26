-- Payment disputes (chargebacks) raised by buyers through their bank/card issuer.
--
-- Written only by the Stripe webhook (service role) on charge.dispute.* events.
-- When a dispute opens we also freeze the order's payout (orders.payout_status =
-- 'frozen') and, if the seller was already paid, reverse the Stripe transfer or
-- claw back their wallet credit — so the platform isn't left covering the loss
-- if the chargeback is ultimately lost.

CREATE TABLE IF NOT EXISTS payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_aud NUMERIC(12,2),
  reason TEXT,
  -- Stripe dispute status: warning_needs_response, needs_response, under_review,
  -- won, lost, etc. We keep whatever Stripe sends.
  status TEXT NOT NULL,
  payout_action TEXT,          -- 'transfer_reversed' | 'wallet_clawback' | 'none'
  -- Admin resolution (set when a moderator releases or keeps the frozen payout).
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_disputes_order   ON payment_disputes (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_seller  ON payment_disputes (seller_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status  ON payment_disputes (status);

ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Backend (service role) only. Disputes are sensitive and never read directly by
-- the client; admin tooling reads them through the service-role backend.
CREATE POLICY "Service role manages disputes" ON payment_disputes
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
