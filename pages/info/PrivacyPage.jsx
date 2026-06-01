import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { ShieldCheck } from 'lucide-react';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const PrivacyPage = () => {
  return (
    <InfoPageLayout
      icon={ShieldCheck}
      eyebrow="CardPop Australia"
      title="Privacy Policy"
      description="How we collect, use, and protect your personal information."
    >
      <SEOHead title="Privacy Policy | CardPop" description="CardPop's privacy policy — how we collect, use and protect your personal information." />

      <p className="text-sm text-muted-foreground mb-8">Last Updated: May 10, 2026</p>

      <h2>Information We Collect</h2>
      <p>We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us. This includes your name, email address, shipping address, and payment information.</p>

      <h2>How We Use Your Information</h2>
      <p>We use the information we collect to provide, maintain, and improve our services, process transactions, send administrative messages, and protect against fraudulent activity.</p>

      <h2>Information Sharing</h2>
      <p>We do not sell your personal information. We may share information with third-party vendors who perform services on our behalf, such as payment processing and shipping.</p>

      <h2>Data Security</h2>
      <p>We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction.</p>

      <h2>Your Rights</h2>
      <p>You have the right to access, correct, or delete your personal information. You can manage most of this data directly through your account settings.</p>
    </InfoPageLayout>
  );
};

export default PrivacyPage;
