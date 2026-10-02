import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { SHOP_RETURN_POLICY } from '@/utils/shopReturnPolicy.js';

const { windowDays, refundProcessingDays } = SHOP_RETURN_POLICY;

const ReturnsPage = () => {
  return (
    <InfoPageLayout
      title="Returns & Refunds"
      description="How returns, exchanges and refunds work for CardPop Shop products and marketplace purchases."
      breadcrumbs={[{ label: 'Returns & Refunds' }]}
    >
      <SEOHead
        title="Returns & Refund Policy | CardPop"
        description={`CardPop's returns policy — ${windowDays}-day returns and exchanges on new CardPop Shop products, plus buyer protection and refunds on marketplace purchases.`}
      />

      <h2>Overview</h2>
      <p>
        CardPop sells two kinds of items, and each has its own returns policy:
      </p>
      <ul>
        <li>
          <strong>CardPop Shop products</strong> — new products sold by CardPop itself (binders, sleeves,
          storage and other supplies in the <Link to="/shop">Shop</Link>). These can be returned or exchanged
          within {windowDays} days, for any reason.
        </li>
        <li>
          <strong>Marketplace purchases</strong> — cards bought from other CardPop sellers. These are covered
          by buyer protection (see <a href="#marketplace">Marketplace purchases</a> below).
        </li>
      </ul>
      <p>
        Returns are available within Australia. Nothing in this policy limits your rights under the
        Australian Consumer Law.
      </p>

      <h2 id="shop">CardPop Shop Returns &amp; Exchanges (New Products)</h2>
      <p>This policy applies to new products bought from the CardPop Shop.</p>
      <ul>
        <li>
          <strong>Return window:</strong> {windowDays} days from the day your order is delivered.
        </li>
        <li>
          <strong>Defective and non-defective items:</strong> we accept returns of faulty items <em>and</em>
          change-of-mind returns. For a change-of-mind return the item must be new and unused, in its original
          condition and packaging.
        </li>
        <li>
          <strong>Exchanges:</strong> accepted — swap for a different colour, size or product, subject to stock.
        </li>
        <li>
          <strong>Return method:</strong> by mail. You arrange the return postage and the cost of the return
          postage is your responsibility. We recommend a tracked service, as we can&apos;t refund a return that
          doesn&apos;t reach us.
        </li>
        <li>
          <strong>Restocking fee:</strong> none. There is no charge for returning an item.
        </li>
        <li>
          <strong>Refund processing time:</strong> once your return arrives and has been checked, your refund is
          processed within {refundProcessingDays} days to your original payment method. Your bank may take a few
          extra business days to show it on your statement.
        </li>
      </ul>

      <h3>How to return or exchange a Shop product</h3>
      <ol>
        <li>
          Within {windowDays} days of delivery, email{' '}
          <a href="mailto:support@cardpop.com.au">support@cardpop.com.au</a> (or use the{' '}
          <Link to="/contact">contact page</Link>) with your order number, the item(s) you&apos;re returning and whether
          you&apos;d like a refund or an exchange.
        </li>
        <li>We&apos;ll reply with the return address and instructions.</li>
        <li>Post the item back to us, well packed, with your order number included.</li>
        <li>
          Once it arrives we&apos;ll process your refund within {refundProcessingDays} days, or send out your
          exchange.
        </li>
      </ol>

      <h2 id="marketplace">Marketplace Purchases</h2>
      <p>
        CardPop offers buyer protection on all marketplace purchases. If something goes wrong, you can
        request a refund within <strong>30 days of purchase</strong> through your account. We&apos;ll review
        every request within 2 business days and, where approved, issue the refund directly to your
        original payment method. Because marketplace cards are sold by individual sellers, the
        change-of-mind returns offered on CardPop Shop products don&apos;t apply to marketplace purchases.
      </p>

      <h3>Platform Fee Retention on Marketplace Refunds</h3>
      <p>
        When a marketplace refund is issued, <strong>50% of the platform fee is non-refundable.</strong> This covers
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

      <h3>Eligible Refund Reasons</h3>
      <p>A marketplace refund may be approved when:</p>
      <ul>
        <li>The item was not received within a reasonable timeframe.</li>
        <li>The item received is significantly not as described (wrong card, wrong condition grade).</li>
        <li>The item arrived damaged in transit (photo evidence of packaging required).</li>
        <li>The item is proven counterfeit.</li>
        <li>The seller cancelled the order after payment.</li>
      </ul>

      <h3>Non-Eligible Reasons</h3>
      <p>Marketplace refunds will not be approved for:</p>
      <ul>
        <li>Change of mind or buyer's remorse.</li>
        <li>Market price fluctuations after the purchase date.</li>
        <li>Minor subjective condition discrepancies on raw (ungraded) cards.</li>
        <li>Requests made more than 30 days after the purchase date.</li>
      </ul>

      <h3>How to Request a Marketplace Refund</h3>
      <ol>
        <li>Go to <strong>My Account → Orders</strong>.</li>
        <li>Find the relevant order and click <strong>Request Refund</strong>.</li>
        <li>Select the reason and provide any supporting details or photos.</li>
        <li>CardPop will review within 2 business days and notify you of the outcome by email and in-app notification.</li>
        <li>If approved, the refund is issued via Stripe and takes <strong>5–10 business days</strong> to appear on your statement.</li>
      </ol>

      <h3>Seller Obligations</h3>
      <p>
        Sellers are required to accurately describe item condition and grade. Where a refund is approved
        due to misrepresentation, the seller's proceeds may be clawed back at CardPop's discretion and
        repeat violations may result in account suspension.
      </p>

      <h3>Disputes</h3>
      <p>
        If you and the seller cannot resolve an issue directly, contact CardPop support with your order
        number and evidence. Our team will mediate and make a binding decision within 5 business days.
      </p>
    </InfoPageLayout>
  );
};

export default ReturnsPage;
