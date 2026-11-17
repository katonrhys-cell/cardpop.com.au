// CardPop's Terms of Service — the one copy.
//
// pages/info/TermsPage.jsx renders these sections for visitors and
// api/prerender.js renders the same array for crawlers, so the page Google
// indexes and the page a member agrees to cannot drift apart (the old page was
// five two-sentence sections, hand-copied into both places).
//
// Every figure a policy owns comes from that policy's own constants — the
// buyer-protection windows, the shop return window, the membership prices —
// never typed here. Change a rule in its source file and this document follows.
//
// This text describes how the platform actually works; it was not drafted by a
// lawyer. Have it reviewed before relying on it in a dispute, and bump
// TERMS_UPDATED whenever the wording changes.
//
// Dependency-free (no React, no Supabase): the prerenderer runs it in a bare
// Node function.

import { MARKETPLACE_PROTECTION } from '../utils/buyerProtectionPolicy.js';
import { SHOP_RETURN_POLICY } from '../utils/shopReturnPolicy.js';
import { TIER_PRICES_AUD } from '../config/subscription.js';

/** ISO date the wording last changed. */
export const TERMS_UPDATED = '2026-11-17';
export const TERMS_UPDATED_LABEL = '17 November 2026';

export const TERMS_TITLE = 'Terms of Service | CardPop™';
export const TERMS_DESCRIPTION =
  'The CardPop™ Terms of Service: accounts, buying and selling on the marketplace, binding offers, fees and payouts, Buyer Protection, shop orders, memberships, events and your rights under Australian Consumer Law.';
export const TERMS_INTRO =
  'These terms are the agreement between you and CardPop Australia™ when you use cardpop.com.au — to browse, buy, sell, list an event or hold a membership. Please read them with the Privacy Policy and the Returns & Refunds policy, which form part of them.';

const MP = MARKETPLACE_PROTECTION;
const OFFER_HOURS = 48;

/**
 * [{ h2, paras?: string[], items?: [{ text, href? }] }] — the shape
 * api/prerender.js's STATIC_CONTENT sections already use.
 */
export const TERMS_SECTIONS = [
  {
    h2: '1. About these terms',
    paras: [
      'CardPop Australia™ (“CardPop”, “we”, “us”) operates cardpop.com.au: a marketplace where collectors buy and sell trading cards, a shop selling CardPop’s own collecting supplies, and free resources such as price guides, grading tools, an events calendar and a card shop directory.',
      'By creating an account, placing an order, listing a card or an event, or otherwise using the site, you agree to these terms. If you do not agree, please do not use the site.',
      'We may update these terms as the platform changes. The date at the top shows when they last changed. For a change that materially affects members we will give notice by email or on the site before it takes effect; continuing to use CardPop after that date means you accept the updated terms.',
    ],
  },
  {
    h2: '2. Your account',
    items: [
      { text: 'You must be at least 18 years old to create an account, buy or sell.' },
      { text: 'Give accurate details and keep them current. One person, one account — do not create further accounts to get around a restriction or a suspension.' },
      { text: 'Keep your password and any two-step verification codes to yourself. You are responsible for activity on your account; tell us straight away at support@cardpop.com.au if you think someone else has access.' },
      { text: 'We may ask you to confirm your email address and, for higher-value marketplace purchases and for seller payouts, to verify your identity through our payments provider. We can decline or limit an account that cannot be verified.' },
    ],
  },
  {
    h2: '3. Buying on the marketplace',
    paras: [
      'Marketplace cards are sold by other CardPop members, not by CardPop. The seller is responsible for the card and its description. CardPop runs the platform, takes the payment, holds it, and pays the seller under these terms.',
      'A marketplace sale is binding once you pay: there are no change-of-mind returns on another collector’s card. If the card is not what was advertised, or never arrives, you are covered by CardPop Buyer Protection (section 7).',
      'Checkout is available to buyers in Australia paying with an Australian-issued card, and orders are delivered to Australian addresses only. A payment from a card issued elsewhere may be refused and refunded.',
      'All prices are in Australian dollars and include GST. The total you pay — the card, the seller’s postage, CardPop’s service fee and a payment-processing fee — is shown in full before you confirm the order.',
    ],
  },
  {
    h2: '4. Offers',
    items: [
      { text: `An offer you make on a listing is binding for ${OFFER_HOURS} hours unless you withdraw it first. If the seller accepts within that time, you have agreed to buy at that price.` },
      { text: `Once an offer is accepted — or you accept a seller’s counter-offer — you have ${OFFER_HOURS} hours to pay. An accepted offer that is not paid in time lapses, and the seller is free to sell to someone else.` },
      { text: 'Sellers may decline or counter any offer, and may switch offers off on a listing. Repeatedly making offers you do not honour may lead to restrictions on your account.' },
    ],
  },
  {
    h2: '5. Selling on the marketplace',
    items: [
      { text: 'List only cards you own and have in your possession. Describe each card accurately — the exact card, its condition or grade, and any flaw — and use your own photographs of the actual card.' },
      { text: 'Do not list counterfeit, altered, trimmed, re-sealed or stolen items, or anything it is unlawful to sell. Graded cards must show the genuine grading company’s certification.' },
      { text: `Post each sold card within ${MP.notShippedClaimAfterDays} days using a tracked service, packed to protect it, and record the tracking number on the order. Until the parcel is delivered, the risk of loss or damage in transit is yours.` },
      { text: 'Complete every sale made through CardPop on CardPop. Do not ask a buyer to pay outside the platform — a sale taken off-platform is not protected and may lead to suspension.' },
      { text: 'You are responsible for your own tax affairs. If you sell as a business you must hold any registration the law requires, and you warrant that any ABN you give us is yours.' },
    ],
  },
  {
    h2: '6. Fees, GST and payouts',
    paras: [
      'Browsing, creating an account and listing a card are free. When a card sells, CardPop charges a service fee, and the buyer pays a payment-processing fee that covers the cost of taking the payment. The current rates are shown on the Pricing page and in the order summary before either party commits.',
      'Every price on CardPop includes GST. On a marketplace sale, the GST included in the card’s price and the seller’s postage is deducted from the seller’s payout and remitted by CardPop; the payout breakdown shows the card price, the service fee, that GST amount and the postage.',
      'Payouts are made through Stripe, our payments provider, to the bank account you connect, and are subject to Stripe’s own terms. Until you connect an account, proceeds are held in your CardPop balance. Where a Buyer Protection claim on an order is approved, the payout for that order is reversed.',
      'We may change our fees. A change applies only to sales made after it takes effect, and we will publish it on the Pricing page beforehand.',
    ],
  },
  {
    h2: `7. ${MP.name}`,
    paras: [
      `Every marketplace order is covered. If the card is significantly not as described, arrives damaged, is counterfeit or altered, or never arrives, report it from My Account → Orders within ${MP.claimWindowDaysFromDelivery} days of delivery (and in any case within ${MP.hardCapDaysFromPurchase} days of purchase). If an order has not been posted within ${MP.notShippedClaimAfterDays} days you can report it as not received.`,
      `We review each claim within ${MP.reviewBusinessDays} business days and may ask either party for photographs or other evidence. An approved claim is refunded in full — the card, the postage, the service fee and the processing fee — to your original payment method within ${MP.refundProcessingDays} days, and we may ask you to return the card to the seller first.`,
      'Buyer Protection does not cover change of mind, a market price that moves after you buy, or minor differences of opinion about the condition of an ungraded card that matches its photos and description. The full policy is on the Returns & Refunds page.',
    ],
  },
  {
    h2: '8. CardPop Shop orders',
    paras: [
      'Products in the CardPop Shop are sold by CardPop. Prices include GST; delivery charges are shown at checkout. We deliver within Australia.',
      `New shop products can be returned or exchanged within ${SHOP_RETURN_POLICY.windowDays} days of delivery for any reason, provided they are unused and in their original packaging. You arrange and pay the return postage. Refunds are processed within ${SHOP_RETURN_POLICY.refundProcessingDays} days of the return arriving.`,
      'A product marked Pre-order is paid for in full when you order and is posted when stock arrives; the estimated date shown is our best estimate, not a guarantee. If a pre-order is significantly delayed or cannot be supplied, you may cancel it for a full refund.',
      'We try to keep stock and prices accurate. If an item was listed at an obviously incorrect price or cannot be supplied, we may cancel that order and refund you in full.',
    ],
  },
  {
    h2: '9. Memberships',
    items: [
      { text: `The Hobby plan is free. Pro ($${TIER_PRICES_AUD.pro} a year) and Ultimate ($${TIER_PRICES_AUD.ultimate} a year) are paid memberships; prices are in Australian dollars and include GST. What each plan includes is set out on the Pricing page.` },
      { text: 'A paid membership is charged in full when you join — there is no free trial — and renews automatically each year at the then-current price until you cancel. We email a reminder before each renewal.' },
      { text: 'You can cancel at any time from Account → Membership. Cancelling stops the next renewal; your membership stays active until the end of the year you have paid for, and the current year is not refunded except where the law requires it.' },
      { text: 'Moving up a plan is charged pro-rata straight away. Moving down takes effect with a credit applied to your next renewal.' },
    ],
  },
  {
    h2: '10. Events, card shops and other listings',
    paras: [
      'Organisers and shop owners may list events and manage their pages on CardPop. You must have the right to publish what you submit, and it must be accurate — dates, venue, prices and ticket links in particular. We review submissions and may edit, decline or remove a listing.',
      'CardPop does not run the events or shops it lists and does not sell their tickets. Tickets are bought from the organiser, on the organiser’s terms; check details with the organiser before you travel.',
      'Paid promotion for an event — Featured Placement and promotional extras — is a service supplied by CardPop at the price shown when you buy it. It buys the placement or the promotion described, not any particular number of views, ticket sales or attendees.',
    ],
  },
  {
    h2: '11. Price guides, grading tools and other information',
    paras: [
      'Price guides, market data, articles, grading estimates, scan results and the ROI calculator are general information to help you research the hobby. Prices are drawn from third-party listings and sales and can be incomplete, delayed or wrong for a particular card.',
      'Some tools use artificial intelligence. A grade estimate is a preliminary guide only — it is not a grade, and a grading company may reach a different result. A scan may identify a card incorrectly; check the details before you list.',
      'Nothing on CardPop is financial, investment or tax advice. Trading cards can fall in value as well as rise. Make your own decisions and seek professional advice where you need it.',
    ],
  },
  {
    h2: '12. Acceptable use',
    paras: ['When you use CardPop you must not:'],
    items: [
      { text: 'break the law, or infringe anyone else’s rights, including their intellectual property and privacy;' },
      { text: 'mislead other members — shill bidding, fake reviews or ratings, false descriptions, or manipulating prices or offers;' },
      { text: 'harass, threaten or abuse other members or our team, or post content that is hateful, obscene or defamatory;' },
      { text: 'use another person’s account, payment method or identity, or attempt a chargeback on a payment you authorised without first using Buyer Protection;' },
      { text: 'scrape, copy or republish the site’s data in bulk, interfere with its security or operation, or access it by automated means other than as a search engine or as we permit in writing;' },
      { text: 'send spam, or use member contact details for anything other than completing a CardPop transaction.' },
    ],
  },
  {
    h2: '13. Your content',
    paras: [
      'You keep ownership of the photos, descriptions, reviews, posts and other content you add. You give CardPop a non-exclusive, royalty-free licence to host, display, reproduce and adapt that content on the site and in promoting CardPop and your listings (for example in search results, social posts and newsletters), for as long as the content remains on the platform and for a reasonable period afterwards.',
      'You confirm that you have the right to post it, and that it is accurate and not unlawful. We may remove content that breaks these terms or that we reasonably believe exposes anyone to harm or liability. To report content, including a claim of copyright infringement, email support@cardpop.com.au.',
    ],
  },
  {
    h2: '14. CardPop’s content and brand',
    paras: [
      'The CardPop name and logo, the site’s design and software, and our own articles, guides and data are owned by CardPop or its licensors. You may view and share pages for personal, non-commercial use; you may not copy or reuse them commercially without our written permission. The embeddable price widget may be used as described on its page.',
      'Card names, images and brands shown on the site belong to their respective owners. CardPop is not affiliated with, endorsed or sponsored by any card manufacturer, sporting league or grading company.',
    ],
  },
  {
    h2: '15. Third-party services, links and advertising',
    paras: [
      'Payments are processed by Stripe; some pages link to or embed third-party sites and services, show advertising, or contain affiliate links through which CardPop may earn a commission at no extra cost to you. We do not control those third parties and are not responsible for their content, products or terms. How we use cookies and advertising technology is explained in the Privacy Policy.',
    ],
  },
  {
    h2: '16. Suspending or closing an account',
    paras: [
      'You may close your account at any time by emailing support@cardpop.com.au. Orders, claims and payouts already under way are completed first.',
      'We may remove a listing, withhold a payout that is the subject of a claim or a suspected fraud, or restrict, suspend or close an account, where we reasonably believe these terms have been broken, where it is needed to protect other members or CardPop, or where the law requires it. Where we reasonably can, we will tell you why and give you the chance to respond.',
    ],
  },
  {
    h2: '17. Your rights under Australian Consumer Law',
    paras: [
      'Nothing in these terms excludes, restricts or modifies any guarantee, right or remedy you have under the Australian Consumer Law or any other law that cannot lawfully be excluded. Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. The promises in our Buyer Protection and Returns policies are in addition to those rights.',
    ],
  },
  {
    h2: '18. Our liability',
    paras: [
      'CardPop provides the platform; marketplace cards are supplied by the members who list them. Beyond the remedies in Buyer Protection, we are not responsible for the conduct of other members, or for the accuracy of listings, events or shop details that others supply.',
      'To the extent the law allows — and always subject to section 17 — CardPop is not liable for indirect or consequential loss, loss of profit or loss of opportunity arising from your use of the site, and our total liability in connection with an order is limited to the amount you paid for that order. Where our liability under a consumer guarantee can lawfully be limited, it is limited to supplying the goods or services again, or paying the cost of doing so.',
      'We work to keep the site available and secure but do not promise it will be uninterrupted or error-free.',
    ],
  },
  {
    h2: '19. Disputes',
    paras: [
      'If something goes wrong, contact support@cardpop.com.au with your order number and we will try to resolve it promptly. For a dispute between a buyer and a seller, CardPop reviews the evidence from both sides and decides the outcome of the claim under Buyer Protection. This does not stop you from contacting your state or territory consumer protection agency, or from taking a matter to a court or tribunal.',
    ],
  },
  {
    h2: '20. Governing law',
    paras: [
      'These terms are governed by the laws of Victoria, Australia, and the courts of Victoria have non-exclusive jurisdiction. If any part of these terms is found to be unenforceable, the rest continues to apply.',
    ],
  },
  {
    h2: '21. Contact',
    paras: [
      'Questions about these terms: support@cardpop.com.au, or by post to CardPop Australia™, PO Box 1024, Ascot Vale, Victoria 3032, Australia.',
    ],
  },
];

export const TERMS_LINKS = [
  { text: 'Privacy Policy', href: '/privacy-policy' },
  { text: 'Returns & Refunds', href: '/returns' },
  { text: 'Buyer Protection & Safety', href: '/trust-safety' },
  { text: 'Pricing & Plans', href: '/pricing' },
  { text: 'Contact', href: '/contact' },
];
