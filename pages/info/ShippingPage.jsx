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
      <p>CardPop Shop orders ship tracked within Australia.</p>

      <ul>
        <li><strong>Orders under $100:</strong> $15 flat-rate shipping, charged once per order</li>
        <li><strong>Orders of $100 or more:</strong> Free shipping</li>
      </ul>
      <p>The $100 threshold is based on the CardPop Shop items in your cart. Marketplace cards bought from other sellers ship at the postage price each seller sets, shown on the listing. All prices include GST.</p>

      <h2>International Shipping</h2>
      <p>We currently ship to Australian addresses only.</p>

      <h2>Packaging Standards</h2>
      <p>All single cards are shipped in a penny sleeve, top loader, and team bag, secured between rigid cardboard to prevent bending during transit. Graded cards are shipped in protective sleeves with bubble wrap.</p>
      
      <h2>Vault Transfers</h2>
      <p>Items purchased and sent directly to your CardPop Vault incur zero shipping fees. You only pay shipping when you request a physical withdrawal from your vault.</p>
    </InfoPageLayout>
  );
};

export default ShippingPage;