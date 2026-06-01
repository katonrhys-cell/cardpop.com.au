import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const ReturnsPage = () => {
  return (
    <InfoPageLayout 
      title="Returns & Refunds" 
      description="Our policy for returns, refunds, and dispute resolution."
      breadcrumbs={[{ label: 'Returns' }]}
    >
      <SEOHead title="Returns Policy | CardPop" description="CardPop's returns and refund policy — buyer protection and how we handle disputes on the marketplace." />
      
      <h2>Return Policy Overview</h2>
      <p>Due to the volatile nature of trading card markets, all sales are generally considered final. However, we offer buyer protection in specific circumstances.</p>
      
      <h2>Eligible Returns</h2>
      <p>You may be eligible for a return and refund if:</p>
      <ul>
        <li>The item received is significantly not as described (e.g., wrong card, wrong condition).</li>
        <li>The item is proven to be counterfeit.</li>
        <li>The item was damaged in transit (requires photo evidence of packaging).</li>
      </ul>
      
      <h2>Non-Eligible Returns</h2>
      <p>We do not accept returns for:</p>
      <ul>
        <li>Change of mind or buyer's remorse.</li>
        <li>Market price fluctuations after purchase.</li>
        <li>Minor condition discrepancies on raw (ungraded) cards, as condition is subjective.</li>
      </ul>
      
      <h2>How to Request a Return</h2>
      <p>If you believe your order qualifies for a return, please contact our support team within 3 days of delivery with your order number and clear photos of the item received.</p>
    </InfoPageLayout>
  );
};

export default ReturnsPage;