import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { ShieldHalf } from 'lucide-react';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const TrustSafetyPage = () => {
  return (
    <InfoPageLayout
      icon={ShieldHalf}
      eyebrow={<>CardPop<sup className="text-[0.6em]">™</sup> Australia</>}
      title="Trust & Safety"
      description="How we protect every buyer and seller in our community."
    >
      <SEOHead title="Trust & Safety | CardPop™" description="CardPop™'s trust and safety policies — how we protect buyers and sellers in the Australian trading card community." />

      <h2>Buyer Protection</h2>
      <p>When you purchase on CardPop<sup className="text-[0.6em]">™</sup>, your payment is processed securely through Stripe and every order is backed by our 14-day Buyer Protection Guarantee. If an item doesn't arrive within the expected timeframe, or is significantly not as described, you can request a full refund through our resolution process.</p>

      <h2>Seller Protection</h2>
      <p>Sellers are protected against fraudulent chargebacks and false claims. As long as you ship to the verified address with tracking and signature confirmation, you are covered.</p>

      <h2>Authentication Services</h2>
      <p>For high-value items and trades, we offer middleman authentication services. Items are shipped to our facility where experts verify authenticity and condition before forwarding to the buyer.</p>

      <h2>Community Guidelines</h2>
      <p>We maintain a zero-tolerance policy for fraud, harassment, and market manipulation. Users found violating these guidelines will be permanently banned from the platform.</p>
    </InfoPageLayout>
  );
};

export default TrustSafetyPage;
