import React from 'react';
import { Helmet } from 'react-helmet';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const AboutPage = () => {
  return (
    <InfoPageLayout 
      title="About CardPop" 
      description="Australia's premier destination for trading card collectors."
      breadcrumbs={[{ label: 'About Us' }]}
    >
      <Helmet>
        <title>About Us | CardPop</title>
      </Helmet>
      
      <h2>Our Mission</h2>
      <p>
        At CardPop, we believe that collecting is more than just a hobby—it's a passion that connects people across generations. Our mission is to provide a secure, transparent, and vibrant marketplace for collectors in Australia and beyond.
      </p>
      
      <h2>Our Story</h2>
      <p>
        Founded by lifelong collectors, CardPop was born out of frustration with existing platforms that lacked specialized tools for trading cards. We built the platform we always wanted to use: one with accurate market data, secure vaulting, and a community-first approach.
      </p>
      
      <h2>Why Choose Us?</h2>
      <ul>
        <li><strong>Security First:</strong> Every transaction is protected, and our vaulting service ensures your high-value items are safe.</li>
        <li><strong>Market Intelligence:</strong> Access real-time pricing data and trends to make informed decisions.</li>
        <li><strong>Community Driven:</strong> We host events, facilitate trades, and foster a welcoming environment for all collectors.</li>
      </ul>
    </InfoPageLayout>
  );
};

export default AboutPage;