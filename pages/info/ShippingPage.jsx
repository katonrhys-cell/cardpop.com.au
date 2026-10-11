import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';
import { MARKETPLACE_PROTECTION } from '@/utils/buyerProtectionPolicy.js';
import { CARRIERS } from '@/utils/shipmentTracking.js';

// Shop shipping numbers come from the same platform settings the server
// prices with (free_shipping_threshold_aud / default_shipping_rate_aud), so an
// admin change shows here without a deploy. Marketplace expectations come from
// utils/buyerProtectionPolicy.js.
const ShippingPage = () => {
  const { settings } = usePlatformSettings();
  const threshold = Number(settings.free_shipping_threshold_aud) || 100;
  const rate = Number(settings.default_shipping_rate_aud) || 15;
  const carriers = Object.values(CARRIERS).filter((c) => c.trackUrl).map((c) => c.label);

  return (
    <InfoPageLayout
      title="Shipping Information"
      description="How CardPop Shop orders and marketplace cards get to you, what it costs, and how long it takes."
      breadcrumbs={[{ label: 'Shipping' }]}
    >
      <SEOHead title="Shipping Information | CardPop" description={`CardPop ships within Australia. Shop orders: $${rate} flat, free from $${threshold}, tracked. Marketplace cards ship at the seller's listed postage, posted within ${MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days.`} />

      <h2>CardPop Shop orders</h2>
      <ul>
        <li><strong>Orders under ${threshold}:</strong> ${rate} flat-rate tracked shipping, charged once per order</li>
        <li><strong>Orders of ${threshold} or more:</strong> free tracked shipping</li>
        <li><strong>Dispatch:</strong> within 2 business days of your order (pre-orders ship when stock arrives — the estimate is shown on the product and at checkout)</li>
        <li><strong>Delivery:</strong> typically 3–7 business days with Australia Post, depending on where you are</li>
      </ul>
      <p>The ${threshold} threshold is based on the CardPop Shop items in your cart. All prices include GST.</p>

      <h2>Marketplace cards (bought from other collectors)</h2>
      <ul>
        <li><strong>Postage:</strong> set by each seller and shown on the listing and in your cart before you pay; many sellers offer free postage</li>
        <li><strong>Dispatch:</strong> sellers are expected to post within {MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days of your order, using a tracked service, and to mark the order as posted with the tracking number — you&apos;ll get an email with the tracking link</li>
        <li><strong>If it isn&apos;t posted in time:</strong> after {MARKETPLACE_PROTECTION.notShippedClaimAfterDays} days with no tracking you can report the order as not received from My Account → Orders and be refunded in full</li>
        <li><strong>If it goes missing:</strong> a tracked parcel that never arrives is the seller&apos;s loss, not yours — see <Link to="/returns#marketplace">Buyer Protection</Link></li>
      </ul>

      <h2>Carriers and tracking</h2>
      <p>
        Tracking links on CardPop support {carriers.slice(0, -1).join(', ')} and {carriers.slice(-1)}. Every shipped order shows its carrier and
        tracking number in My Account → Orders, and the shipped email carries the same link.
      </p>

      <h2>Where we ship</h2>
      <p>We currently ship to Australian addresses only, and accept payment from Australian-issued cards and PayPal.</p>

      <h2>Packaging standards</h2>
      <p>Single cards are shipped in a penny sleeve and top loader (or team bag), secured between rigid cardboard to prevent bending in transit. Graded cards are shipped in protective sleeves with bubble wrap. Sealed product is boxed, not bagged. Sellers are held to the same standard — a card that arrives damaged because it was poorly packed is covered by Buyer Protection.</p>
    </InfoPageLayout>
  );
};

export default ShippingPage;
