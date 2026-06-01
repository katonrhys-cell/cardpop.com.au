import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { ScrollText } from 'lucide-react';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const TermsPage = () => {
  return (
    <InfoPageLayout
      icon={ScrollText}
      eyebrow="CardPop Australia"
      title="Terms of Service"
      description="The rules and guidelines for using the CardPop platform."
    >
      <SEOHead title="Terms of Service | CardPop" description="CardPop's terms of service — the rules and guidelines for using the platform." />

      <p className="text-sm text-muted-foreground mb-8">Last Updated: May 10, 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using CardPop, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>

      <h2>2. User Accounts</h2>
      <p>You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

      <h2>3. Marketplace Rules</h2>
      <p>Users agree to provide accurate descriptions and images of items listed for sale. CardPop reserves the right to remove listings that violate our policies or appear fraudulent.</p>

      <h2>4. Fees and Payments</h2>
      <p>CardPop charges fees for certain services, including sales commissions. All fees are clearly displayed before you commit to a transaction. You agree to pay all applicable fees.</p>

      <h2>5. Limitation of Liability</h2>
      <p>CardPop is a marketplace facilitator. We are not responsible for the actions of individual users, though we provide protection programs as outlined in our Trust &amp; Safety policy.</p>
    </InfoPageLayout>
  );
};

export default TermsPage;
