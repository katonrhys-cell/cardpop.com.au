import React from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import InfoPageLayout from '@/components/InfoPageLayout.jsx';
import { TIER_PRICES_AUD, TRIAL_DAYS } from '@/config/subscription.js';
import { LISTINGS_PER_MONTH } from '@/config/plans.js';

// Terms of Service. The numbers in the Plans section (prices, listing
// allowances, trial length) are read from config/subscription.js and
// config/plans.js rather than typed in, so a pricing change can't leave the
// legal page quietly contradicting what the checkout actually charges.
const TermsPage = () => {
  const unlimited = (n) => (n === null ? 'unlimited' : n);

  return (
    <InfoPageLayout
      icon={ScrollText}
      eyebrow="CardPop™ Australia"
      title="Terms of Service"
      description="The rules and guidelines for using the CardPop™ platform."
      breadcrumbs={[{ label: 'Terms of Service' }]}
    >
      <SEOHead title="Terms of Service | CardPop™" description="CardPop™'s terms of service — accounts, marketplace rules, fees, memberships, payouts, refunds and your rights under Australian Consumer Law." />

      <p className="text-sm text-muted-foreground mb-8">Last Updated: 6 August 2026</p>

      <h2>1. Who we are and what these terms cover</h2>
      <p>
        CardPop™ (&quot;CardPop&quot;, &quot;we&quot;, &quot;us&quot;) operates the website at cardpop.com.au and the
        services available through it — an Australian online marketplace and community for trading cards.
        These Terms of Service form a binding agreement between you and CardPop and govern your use of the
        platform, including browsing, buying, selling, trading, membership plans, community features and
        our published content.
      </p>
      <p>
        Our <Link to="/privacy-policy">Privacy Policy</Link>, <Link to="/returns">Returns &amp; Refunds
        Policy</Link>, <Link to="/trust-safety">Trust &amp; Safety Policy</Link>, <Link
        to="/shipping">Shipping Policy</Link> and <Link to="/photography-standard">Photography
        Standard</Link> are incorporated into these terms. Where a specific policy addresses a topic in
        more detail, that policy applies.
      </p>

      <h2>2. Acceptance and changes</h2>
      <p>
        By creating an account or otherwise using CardPop, you agree to these terms. If you do not agree,
        do not use the platform. We may update these terms as the platform changes; the &quot;Last
        Updated&quot; date above reflects the current version. Where a change materially affects your
        rights, we will give reasonable notice through the platform or by email. Continuing to use CardPop
        after a change takes effect means you accept the revised terms.
      </p>

      <h2>3. Eligibility and your account</h2>
      <p>
        You must be at least 18 years old to create an account. You agree to provide accurate information,
        keep it current, and maintain the confidentiality of your credentials. You are responsible for
        activity that occurs under your account. We strongly recommend enabling multi-factor
        authentication in your <Link to="/account/security">security settings</Link>. Tell us promptly if
        you suspect unauthorised access.
      </p>
      <p>
        One person may hold one account. Accounts are personal to you and may not be sold or transferred.
      </p>

      <h2>4. Identity verification</h2>
      <p>
        Anyone can browse and buy on CardPop. To list, sell or trade, you must first complete identity
        verification, which we carry out through Stripe Identity. We may also require verification, or
        re-verification, where we consider it necessary to protect buyers, sellers or the platform. We may
        decline or revoke selling access where verification is incomplete, fails, or where information
        provided appears inaccurate.
      </p>

      <h2>5. What CardPop is — and is not</h2>
      <p>
        <strong>CardPop is a marketplace facilitator.</strong> For marketplace listings, the contract of
        sale is formed directly between the buyer and the seller. CardPop is not the seller, is not a
        party to that contract, and does not take possession, custody or ownership of cards sold between
        users. Sellers hold their own items and post them directly to buyers.
      </p>
      <p>
        This is distinct from the <Link to="/shop">CardPop Shop</Link>, where CardPop sells products
        directly — see clause 15.
      </p>
      <p>
        We do not guarantee the existence, quality, safety, authenticity, condition or legality of items
        listed by users, the accuracy of listing descriptions, or the ability of any user to complete a
        transaction. We provide tools, protections and dispute handling, but the underlying transaction is
        between users.
      </p>

      <h2>6. The Vault</h2>
      <p>
        The Vault is a <strong>digital record of your own collection</strong> — cards you catalogue, with
        your photos and details. It is not a physical storage or custody service. CardPop does not hold,
        insure or take responsibility for the physical cards recorded in your Vault; they remain in your
        possession at all times. Listing an item from your Vault publishes it to the marketplace, at which
        point the selling obligations in these terms apply.
      </p>
      <p>
        You are responsible for the accuracy of what you record. Estimated or displayed values are
        informational only (see clause 18).
      </p>

      <h2>7. Listing rules for sellers</h2>
      <p>By listing an item, you represent and warrant that:</p>
      <ul>
        <li>You own the item, have it in your possession, and are entitled to sell it.</li>
        <li>Your description, condition grade, photographs and any grading details are accurate and not misleading. Photographs must be of the actual item and meet our <Link to="/photography-standard">Photography Standard</Link>.</li>
        <li>The item is genuine. Counterfeit, reproduction, proxy or altered cards must not be listed as authentic, and knowingly listing a counterfeit is grounds for immediate termination.</li>
        <li>You will honour the listed price and dispatch within the timeframe stated in our <Link to="/shipping">Shipping Policy</Link>.</li>
        <li>The listing complies with applicable Australian law and with the intellectual property rights of card publishers and other third parties.</li>
      </ul>
      <p>
        We may edit, hide, decline or remove any listing, and may limit listing volumes, at our discretion
        — including where a listing appears inaccurate, fraudulent, unsafe or in breach of these terms.
      </p>

      <h2>8. Buying</h2>
      <p>
        Placing an order and completing payment creates a binding contract with the seller. Prices are in
        Australian dollars. You are responsible for reviewing the listing, including condition and
        postage, before purchasing. Buyer protection and refund eligibility are set out in our <Link
        to="/returns">Returns &amp; Refunds Policy</Link>.
      </p>

      <h2>9. Fees, commission and GST</h2>
      <p>
        CardPop charges a platform fee (commission) on marketplace sales. The applicable percentage
        depends on the transaction type and the seller&apos;s earned reputation tier, and is displayed in
        the cost breakdown before a purchase is completed. Australian GST is applied at the prevailing
        rate to the full sale price (item plus commission) where GST applies.
      </p>
      <p>
        All fees are shown before you commit to a transaction. You agree to pay the fees applicable to
        your transactions. We may change our fees prospectively; changes do not affect transactions
        already completed.
      </p>
      <p>
        Postage charged by a seller is a pass-through amount: no commission is taken from it.
      </p>

      <h2>10. Membership plans</h2>
      <p>
        Hobby accounts are free, permanently. Paid plans are billed monthly in Australian dollars and
        unlock a larger monthly listing allowance, a branded storefront in the Local Traders directory,
        and additional Vault display options.
      </p>
      <div className="not-prose bg-muted/40 border border-border rounded-xl p-4 my-4 text-sm">
        <ul className="space-y-1 text-muted-foreground list-none pl-0">
          <li><strong className="text-foreground">Hobby</strong> — free · {unlimited(LISTINGS_PER_MONTH.free)} new listings per calendar month</li>
          <li><strong className="text-foreground">Pro</strong> — ${TIER_PRICES_AUD.pro}/month · {unlimited(LISTINGS_PER_MONTH.pro)} listings</li>
          <li><strong className="text-foreground">Premium</strong> — ${TIER_PRICES_AUD.premium}/month · {unlimited(LISTINGS_PER_MONTH.premium)} listings</li>
          <li><strong className="text-foreground">Elite</strong> — ${TIER_PRICES_AUD.elite}/month · {unlimited(LISTINGS_PER_MONTH.elite)} listings</li>
          <li><strong className="text-foreground">Ultimate</strong> — ${TIER_PRICES_AUD.ultimate}/month · {unlimited(LISTINGS_PER_MONTH.ultimate)} listings</li>
        </ul>
      </div>
      <p>
        <strong>A paid plan buys access, not cheaper fees.</strong> Every plan, including Hobby, pays the
        same per-transaction commission.
      </p>
      <p>
        Paid plans may include a {TRIAL_DAYS}-day trial where offered. Subscriptions renew automatically
        each month until cancelled. You can cancel at any time from <Link
        to="/account/membership">your membership settings</Link>; cancellation takes effect at the end of
        the current billing period and you keep access until then. Except where required by law
        (including the Australian Consumer Law), part-months are not refunded. If a payment fails or a
        subscription lapses, your account reverts to Hobby limits, and listings above the Hobby allowance
        may be affected.
      </p>
      <p>
        Listing allowances are counted per calendar month and do not roll over.
      </p>

      <h2>11. Seller payouts and your wallet</h2>
      <p>
        Payouts are processed through Stripe Connect. Buyers are charged by CardPop, and your proceeds —
        the sale price plus any postage you charged, less commission, GST and any amounts owed — are
        transferred to your connected Stripe account. Until you complete Stripe onboarding, proceeds are
        held in your CardPop wallet balance and released once onboarding is finished.
      </p>
      <p>
        You are responsible for providing accurate payout details. We may withhold, delay, reverse or
        offset a payout where a transaction is disputed or under review, where a refund or chargeback has
        occurred, where we suspect fraud or a breach of these terms, or where required by law. You
        authorise us to recover from your wallet or future proceeds any amount you owe CardPop, including
        refunded amounts and chargebacks.
      </p>
      <p>
        <strong>Tax is your responsibility.</strong> CardPop does not provide tax advice. You are
        responsible for determining and meeting your own tax obligations, including GST registration and
        income reporting where your selling activity requires it.
      </p>

      <h2>12. Shipping and delivery</h2>
      <p>
        Sellers set their own postage price and are responsible for packaging items appropriately,
        dispatching on time, and providing tracking where required by our <Link
        to="/shipping">Shipping Policy</Link>. Risk of loss passes in accordance with that policy. Where a
        buyer purchases multiple items from one seller, postage is charged as a single parcel per seller.
      </p>

      <h2>13. Returns, refunds and disputes</h2>
      <p>
        Refund eligibility, timeframes and the portion of the platform fee retained on a refund are set
        out in full in our <Link to="/returns">Returns &amp; Refunds Policy</Link>. In summary: refund
        requests may be made within 30 days of purchase, are reviewed within two business days, and where
        approved are issued to the original payment method.
      </p>
      <p>
        Buyers and sellers should first attempt to resolve issues directly through platform messaging. If
        that fails, either party may raise a dispute with CardPop. Where we mediate, we do so as a
        facilitator, applying these terms and our policies; our determination governs the release of funds
        held by us but does not remove either party&apos;s legal rights against the other.
      </p>
      <p>Nothing in this clause limits your rights under the Australian Consumer Law (clause 24).</p>

      <h2>14. Offers and trades</h2>
      <p>
        The platform supports offers and card-for-card trade requests. An accepted offer is binding on
        both parties on the same basis as a listed sale. For trades, each participant is responsible for
        accurately describing and dispatching their own items; the same accuracy, authenticity and
        dispatch obligations in clause 7 apply. CardPop is not a party to a trade and buyer protection
        may operate differently where no payment passes through the platform — review the trade terms
        shown to you before accepting.
      </p>

      <h2>15. CardPop Shop</h2>
      <p>
        Products in the <Link to="/shop">CardPop Shop</Link> — including sealed product, singles and
        supplies — are sold by CardPop directly. For those purchases CardPop is the seller, and our
        returns policy and your Australian Consumer Law rights apply against us. Stock availability and
        pricing may change without notice, and we may cancel and refund an order where an item is
        unavailable or where a price was listed in error.
      </p>

      <h2>16. Grading resources and partners</h2>
      <p>
        Our grading guides, scale explanations, estimator and ROI calculator are <strong>informational
        tools only</strong>. Estimated grades, values and returns are not predictions and carry no
        guarantee. Grading outcomes are determined solely by the relevant grading company, and CardPop has
        no control over their decisions, turnaround times or fees.
      </p>
      <p>
        Where we list grading companies, local graders or submission partners, we do so as a directory.
        Any arrangement you enter into with them is between you and them.
      </p>

      <h2>17. Certificate and card data</h2>
      <p>
        Grading certificate lookups and card catalogue details are drawn from third-party sources. We
        present them in good faith but cannot guarantee they are complete, current or error-free, and they
        should not be relied on as the sole basis for a purchase.
      </p>

      <h2>18. Market data, prices and analytics</h2>
      <p>
        Price history, market analytics, buying guides and similar content are provided for general
        information only. They are derived in part from third-party sources including completed sales data
        and may be delayed, incomplete or inaccurate.
      </p>
      <p>
        <strong>Nothing on CardPop is financial, investment or trading advice.</strong> Trading cards are
        not a regulated financial product, values are volatile, and past prices do not indicate future
        prices. You are solely responsible for your own buying, selling and collecting decisions, and you
        should not treat our content as a recommendation to transact.
      </p>

      <h2>19. AI-assisted features and content</h2>
      <p>
        Some features use automated and AI-assisted processing — including card identification from
        photographs, which suggests card details for you to confirm, and parts of our published articles
        and event listings, which are drafted or discovered with automated assistance and reviewed before
        publication.
      </p>
      <p>
        These outputs can be wrong. Suggested card details are a starting point, not a verified
        identification: <strong>you remain responsible for the accuracy of any listing you publish</strong>,
        including where a field was pre-filled by an automated suggestion. Images you upload for
        identification may be processed by our third-party AI providers for that purpose.
      </p>

      <h2>20. Community, user content and conduct</h2>
      <p>
        You retain ownership of content you post — listings, photographs, collection details, forum posts,
        reviews, messages and profile information. By posting it you grant CardPop a non-exclusive,
        worldwide, royalty-free licence to host, store, reproduce, adapt (for formatting and display) and
        publish that content for the purpose of operating and promoting the platform. This licence ends
        when you remove the content, except for copies retained in backups or where we must keep records
        for legal or dispute purposes.
      </p>
      <p>You must not:</p>
      <ul>
        <li>Post unlawful, misleading, harassing, defamatory, hateful or infringing content.</li>
        <li>Manipulate prices, place fake bids or offers, or use multiple accounts to distort activity, reputation or reviews.</li>
        <li>Arrange transactions off-platform to avoid fees, or solicit other users to do so.</li>
        <li>Scrape, crawl or harvest data from the platform other than as permitted by our robots directives, or use automated systems to access it in a way that burdens our infrastructure.</li>
        <li>Attempt to gain unauthorised access to accounts, systems or data, probe our security, or interfere with the operation of the platform.</li>
        <li>Impersonate another person or misrepresent your association with anyone.</li>
      </ul>
      <p>
        We may moderate, edit or remove content and may suspend participation in community features. We
        are not obliged to monitor user content and are not responsible for it.
      </p>

      <h2>21. Reviews, ratings and seller reputation</h2>
      <p>
        Reviews must reflect genuine transactions and honest experience. Seller reputation tiers are
        earned from platform activity such as completed sales and ratings, and are separate from paid
        membership. We may recalculate, adjust or remove ratings and reputation where we identify
        manipulation, error or breach of these terms.
      </p>

      <h2>22. Event listings and directories</h2>
      <p>
        Events, card shops and trader directory entries may be submitted by users or discovered
        automatically, and are reviewed before publication. Details including dates, venues and pricing
        are provided by third parties and can change. Confirm directly with the organiser before
        travelling or paying. CardPop does not run these events and is not responsible for them.
      </p>

      <h2>23. Partners, affiliate links and third-party services</h2>
      <p>
        CardPop may earn a commission from affiliate links and partner arrangements. This never changes
        the price you pay and does not affect our editorial content or search ranking.
      </p>
      <p>
        The platform relies on third-party services including payment processing, identity verification,
        hosting, email and data providers. Their availability and performance are outside our control, and
        your use of some features is also subject to those providers&apos; terms.
      </p>

      <h2>24. Your rights under the Australian Consumer Law</h2>
      <p>
        Our goods and services come with guarantees that cannot be excluded under the Australian Consumer
        Law. Nothing in these terms excludes, restricts or modifies any right or remedy you have under
        that law or any other law where it cannot lawfully be excluded.
      </p>
      <p>
        Where our liability for a failure to comply with a consumer guarantee can lawfully be limited, our
        liability is limited, at our option, to resupplying the services or paying the cost of having them
        resupplied — or, for goods we sell directly, to replacing or repairing the goods, supplying
        equivalent goods, or paying the cost of doing so.
      </p>

      <h2>25. Disclaimers and limitation of liability</h2>
      <p>
        Subject always to clause 24, the platform is provided on an &quot;as is&quot; and &quot;as
        available&quot; basis. We do not warrant that it will be uninterrupted, secure or error-free, or
        that content will be accurate or complete.
      </p>
      <p>
        To the maximum extent permitted by law, CardPop is not liable for indirect, incidental, special or
        consequential loss, loss of profit, loss of opportunity, or loss or corruption of data. To the
        maximum extent permitted by law, our total aggregate liability arising out of or in connection
        with these terms or your use of the platform is limited to the greater of the total fees you paid
        CardPop in the twelve months before the event giving rise to the liability, or AUD $100.
      </p>
      <p>
        We are not liable for the acts or omissions of other users, including a seller&apos;s failure to
        dispatch, a buyer&apos;s failure to pay, or misdescription of an item.
      </p>

      <h2>26. Indemnity</h2>
      <p>
        You agree to indemnify CardPop against claims, losses and reasonable costs arising from your
        breach of these terms, your infringement of another person&apos;s rights, or items you list, sell
        or trade — except to the extent caused by our own negligence or breach.
      </p>

      <h2>27. Suspension and termination</h2>
      <p>
        You may close your account at any time. We may suspend or terminate access, cancel listings and
        withhold payouts where we reasonably believe you have breached these terms or the law, where
        required to protect other users or the platform, or where verification cannot be completed. Where
        practicable and lawful, we will tell you why.
      </p>
      <p>
        On termination, amounts properly owed to you remain payable, subject to clause 11. Clauses that by
        their nature should survive — including fees owed, intellectual property, disclaimers, limitation
        of liability, indemnity and governing law — survive termination.
      </p>

      <h2>28. Intellectual property</h2>
      <p>
        CardPop™, our logos, site design, original written content and software are owned by us or our
        licensors and may not be copied or used without permission. Card names, artwork, set names and
        related marks are the property of their respective publishers; CardPop is not affiliated with,
        endorsed by or sponsored by any card publisher or grading company. If you believe content on the
        platform infringes your rights, contact us at the address below.
      </p>

      <h2>29. Privacy</h2>
      <p>
        We handle personal information in accordance with our <Link to="/privacy-policy">Privacy
        Policy</Link> and the Privacy Act 1988 (Cth). You can request deletion of your data through our{' '}
        <Link to="/data-deletion">data deletion</Link> process.
      </p>

      <h2>30. General</h2>
      <p>
        If any provision of these terms is found unenforceable, it is severed and the remainder continues
        in effect. Our failure to enforce a provision is not a waiver of it. You may not assign your
        rights under these terms without our consent; we may assign ours in connection with a
        restructure or sale of the business.
      </p>

      <h2>31. Governing law</h2>
      <p>
        These terms are governed by the laws of Victoria, Australia. You and CardPop submit to the
        non-exclusive jurisdiction of the courts of Victoria and the courts competent to hear appeals from
        them. Nothing in this clause prevents either party from seeking urgent interlocutory relief.
      </p>

      <h2>32. Contact us</h2>
      <p>
        Questions about these terms can be sent through our <Link to="/contact">contact page</Link> or by
        post to CardPop™, PO Box 1024, Ascot Vale VIC 3032, Australia.
      </p>
    </InfoPageLayout>
  );
};

export default TermsPage;
