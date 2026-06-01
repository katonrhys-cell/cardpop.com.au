import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const AccessibilityPage = () => {
  return (
    <InfoPageLayout 
      title="Accessibility Statement" 
      description="Our commitment to making CardPop accessible to everyone."
      breadcrumbs={[{ label: 'Accessibility' }]}
    >
      <SEOHead title="Accessibility | CardPop" description="CardPop's commitment to making our trading card marketplace accessible to everyone." />
      
      <h2>Our Commitment</h2>
      <p>CardPop is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.</p>
      
      <h2>Conformance Status</h2>
      <p>The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. CardPop strives to be conformant with WCAG 2.1 level AA.</p>
      
      <h2>Feedback</h2>
      <p>We welcome your feedback on the accessibility of CardPop. Please let us know if you encounter accessibility barriers on our platform:</p>
      <ul>
        <li>Email: accessibility@cardpop.com.au</li>
        <li>We try to respond to feedback within 2 business days.</li>
      </ul>
    </InfoPageLayout>
  );
};

export default AccessibilityPage;