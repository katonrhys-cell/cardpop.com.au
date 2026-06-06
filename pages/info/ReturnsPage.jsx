import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';

const ReturnsPage = () => {
  return (
    <InfoPageLayout
      title="Returns & Refunds"
      description="How CardPop handles refunds, what fees are retained, and how to request a return."
      breadcrumbs={[{ label: 'Returns & Refunds' }]}
    >
      <SEOHead
        title="Returns & Refund Policy | CardPop"
        description="CardPop's full refund policy — fee retention, eligible reasons, timelines, and how to request a refund on a marketplace purchase."
      />

      <h2>Overview</h2>
      <p>
        CardPop offers buyer protection on all marketplace purchases. If something goes wrong, you can
        request a refund within <strong>30 days of purchase</strong> through your account. We'll review
        every request within 2 business days and, where approved, issue the refund directly to your
        original payment method.
      </p>

      <h2>Platform Fee Retention on Refunds</h2>
      <p>
        When a refund is issued, <strong>50% of the platform fee is non-refundable.</strong> This covers
        Stripe payment processing costs that CardPop incurs regardless of outcome and cannot recover.
        The remaining 50% of the fee, plus the full item price, is returned to you.
      </p>
      <div className="not-prose bg-muted/40 border border-border rounded-xl p-4 my-4 text-sm space-y-2">
        <p className="font-semibold text-foreground">Example — $100 sale with a $3 platform fee:</p>
        <ul className="space-y-1 text-muted-foreground list-none pl-0">
          <li>✅ Item price refunded: <strong className="text-foreground">$100.00</strong></li>
          <li>✅ 50% of platform fee refunded: <strong className="text-foreground">$1.50</strong></li>
          <li>🔒 Platform fee retained: <strong className="text-foreground">$1.50</strong> (non-refundable)</li>
          <li className="pt-1 border-t border-border font-semibold text-foreground">Total returned to buyer: $101.50 AUD</li>
        </ul>
      </div>
      <p>
        This policy is shown to buyers before they complete every purchase so there are no surprises.
      </p>

      <h2>Eligible Refund Reasons</h2>
      <p>A refund may be approved when:</p>
      <ul>
        <li>The item was not received within a reasonable timeframe.</li>
        <li>The item received is significantly not as described (wrong card, wrong condition grade).</li>
        <li>The item arrived damaged in transit (photo evidence of packaging required).</li>
        <li>The item is proven counterfeit.</li>
        <li>The seller cancelled the order after payment.</li>
      </ul>

      <h2>Non-Eligible Reasons</h2>
      <p>Refunds will not be approved for:</p>
      <ul>
        <li>Change of mind or buyer's remorse.</li>
        <li>Market price fluctuations after the purchase date.</li>
        <li>Minor subjective condition discrepancies on raw (ungraded) cards.</li>
        <li>Requests made more than 30 days after the purchase date.</li>
      </ul>

      <h2>How to Request a Refund</h2>
      <ol>
        <li>Go to <strong>My Account → Orders</strong>.</li>
        <li>Find the relevant order and click <strong>Request Refund</strong>.</li>
        <li>Select the reason and provide any supporting details or photos.</li>
        <li>CardPop will review within 2 business days and notify you of the outcome by email and in-app notification.</li>
        <li>If approved, the refund is issued via Stripe and takes <strong>5–10 business days</strong> to appear on your statement.</li>
      </ol>

      <h2>Seller Obligations</h2>
      <p>
        Sellers are required to accurately describe item condition and grade. Where a refund is approved
        due to misrepresentation, the seller's proceeds may be clawed back at CardPop's discretion and
        repeat violations may result in account suspension.
      </p>

      <h2>Disputes</h2>
      <p>
        If you and the seller cannot resolve an issue directly, contact CardPop support with your order
        number and evidence. Our team will mediate and make a binding decision within 5 business days.
      </p>
    </InfoPageLayout>
  );
};

export default ReturnsPage;
