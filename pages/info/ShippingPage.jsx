import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const ShippingPage = () => {
  return (
    <InfoPageLayout 
      title="Shipping Information" 
      description="Everything you need to know about how we deliver your cards safely."
      breadcrumbs={[{ label: 'Shipping' }]}
    >
      <SEOHead title="Shipping Information | CardPop" description="Learn about CardPop's shipping policies, rates and delivery times for Australian orders." />
      
      <h2>Domestic Shipping (Australia)</h2>
      <p>We offer several shipping options within Australia to ensure your cards arrive safely and securely.</p>
      
      <ul>
        <li><strong>Standard Tracked:</strong> $8.95 (3-5 business days)</li>
        <li><strong>Express Tracked:</strong> $12.95 (1-2 business days)</li>
        <li><strong>Signature Required:</strong> Additional $2.95 (Recommended for high-value items)</li>
      </ul>
      
      <h2>International Shipping</h2>
      <p>We currently ship to New Zealand, USA, Canada, and the UK. International shipping rates are calculated at checkout based on weight and destination.</p>
      
      <h2>Packaging Standards</h2>
      <p>All single cards are shipped in a penny sleeve, top loader, and team bag, secured between rigid cardboard to prevent bending during transit. Graded cards are shipped in protective sleeves with bubble wrap.</p>
      
      <h2>Vault Transfers</h2>
      <p>Items purchased and sent directly to your CardPop Vault incur zero shipping fees. You only pay shipping when you request a physical withdrawal from your vault.</p>
    </InfoPageLayout>
  );
};

export default ShippingPage;