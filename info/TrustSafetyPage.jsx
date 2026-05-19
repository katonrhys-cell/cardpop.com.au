import React from 'react';
import { Helmet } from 'react-helmet';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const TrustSafetyPage = () => {
  return (
    <InfoPageLayout 
      title="Trust & Safety" 
      description="How we protect our community of buyers and sellers."
      breadcrumbs={[{ label: 'Trust & Safety' }]}
    >
      <Helmet>
        <title>Trust & Safety | CardPop</title>
      </Helmet>
      
      <h2>Buyer Protection</h2>
      <p>When you purchase on CardPop, your funds are held securely until the item is delivered and verified. If an item doesn't arrive or is significantly not as described, you are covered by our Buyer Protection Guarantee.</p>
      
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