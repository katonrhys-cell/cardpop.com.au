import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { SHOP_RETURN_POLICY } from '@/utils/shopReturnPolicy.js';
import { MARKETPLACE_PROTECTION, PROTECTION_COPY } from '@/utils/buyerProtectionPolicy.js';

// Every number and rule on this page comes from utils/buyerProtectionPolicy.js
// and utils/shopReturnPolicy.js — the same modules the refund code, the
// Account → Orders window, the checkout strip and api/prerender.js read. Change
// the policy there, never here.
const { windowDays, refundProcessingDays } = SHOP_RETURN_POLICY;
const MP = MARKETPLACE_PROTECTION;

const ReturnsPage = () => {
  return (
    <InfoPageLayout
      title="Returns & Refunds"
      description="How returns, exchanges and refunds work for CardPop Shop products and cards bought from other collectors on the marketplace."
      breadcrumbs={[{ label: 'Returns & Refunds' }]}
    >
      <SEOHead
        title="Returns & Refund Policy | CardPop"
        description={`CardPop's returns policy — ${windowDays}-day returns and exchanges on new CardPop Shop products, and ${MP.name}: a full refund within ${MP.claimWindowDaysFromDelivery} days of delivery when a marketplace card isn't as described or doesn't arrive.`}
      />

      <h2>Overview</h2>
      <p>CardPop sells two kinds of items, and each has its own policy:</p>
      <ul>
        <li>
          <strong>CardPop Shop products</strong> — new products sold by CardPop itself (binders, sleeves,
          storage and other supplies in the <Link to="/shop">Shop</Link>). Return or exchange them within{' '}
          {windowDays} days of delivery, for any reason.
        </li>
        <li>
          <strong>Marketplace purchases</strong> — cards bought from other CardPop collectors. A marketplace
          sale is <strong>binding</strong>: if the card is as advertised, the sale stands. If it isn&apos;t, or it
          never arrives, <strong>{MP.name}</strong> refunds you in full (see <a href="#marketplace">below</a>).
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

      <h2 id="marketplace">Marketplace Purchases — {MP.name}</h2>
      <p>{PROTECTION_COPY.marketplaceSummary}</p>
      <p>{PROTECTION_COPY.notShippedSummary}</p>

      <h3>What you get back</h3>
      <p>
        An approved claim refunds <strong>everything you paid</strong> on the order: the card&apos;s price, the
        seller&apos;s postage, CardPop&apos;s service fee and the payment-processing fee. Nothing is retained.
      </p>
      <div className="not-prose my-4 space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <p className="font-semibold text-foreground">Example — $100 card, $10 postage, $3 service fee, $2.50 processing fee:</p>
        <ul className="list-none space-y-1 pl-0 text-muted-foreground">
          <li>✅ Card refunded: <strong className="text-foreground">$100.00</strong></li>
          <li>✅ Postage refunded: <strong className="text-foreground">$10.00</strong></li>
          <li>✅ Service and processing fees refunded: <strong className="text-foreground">$5.50</strong></li>
          <li className="border-t border-border pt-1 font-semibold text-foreground">Total returned to you: $115.50 AUD</li>
        </ul>
      </div>

      <h3>When a claim is approved</h3>
      <ul>
        {MP.eligibleReasons.map((r) => <li key={r}>{r}</li>)}
      </ul>

      <h3>When a claim isn&apos;t</h3>
      <ul>
        {MP.ineligibleReasons.map((r) => <li key={r}>{r}</li>)}
        <li>Requests made after the window — {MP.claimWindowDaysFromDelivery} days from delivery, and never more than {MP.hardCapDaysFromPurchase} days after purchase.</li>
      </ul>

      <h3>How to make a claim</h3>
      <p>{PROTECTION_COPY.processSummary}</p>

      <h3>Seller obligations</h3>
      <p>
        Sellers must describe condition and grade accurately, post within {MP.notShippedClaimAfterDays} days using a
        tracked service, and carry the risk of a parcel that doesn&apos;t arrive. Where a claim is approved, the
        seller&apos;s payout for that order is reversed. Repeat misdescription leads to account suspension.
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
