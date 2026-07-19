-- Admin-managed affiliate / referral links surfaced on the public
-- "Building your business" page (Community dropdown → /community/building-your-business).
-- Each row is a tool CardPop uses and recommends (Stripe, Google Workspace,
-- Whatnot, Facebook, Kit.com, ...), described from two angles:
--   * why_i_use_it   — how it serves the CardPop business
--   * how_it_helps_you — how it helps a member grow their own card business
-- Public read is limited to published rows; only admins can write.

CREATE TABLE IF NOT EXISTS business_affiliate_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text UNIQUE NOT NULL,
  name             text NOT NULL,
  category         text,
  tagline          text,
  description      text,
  why_i_use_it     text,
  how_it_helps_you text,
  affiliate_url    text NOT NULL,
  cta_label        text NOT NULL DEFAULT 'Learn more',
  logo_url         text,
  icon             text,
  accent           text NOT NULL DEFAULT 'from-brand-red to-brand-blue',
  badge            text,
  sort_order       integer NOT NULL DEFAULT 0,
  is_published     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_affiliate_links_sort_idx
  ON business_affiliate_links (sort_order, name);

ALTER TABLE business_affiliate_links ENABLE ROW LEVEL SECURITY;

-- Public can read published tools only.
DROP POLICY IF EXISTS "business_affiliate_links_public_read" ON business_affiliate_links;
CREATE POLICY "business_affiliate_links_public_read"
  ON business_affiliate_links
  FOR SELECT
  USING (is_published = true);

-- Admins can read (incl. drafts) and manage everything.
DROP POLICY IF EXISTS "admin_manage_business_affiliate_links" ON business_affiliate_links;
CREATE POLICY "admin_manage_business_affiliate_links"
  ON business_affiliate_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Seed the tools CardPop currently uses and recommends. Copy is written in the
-- CardPop voice for an Australian card-selling audience. Admins can edit or add
-- more from the admin portal, so ON CONFLICT keeps this a one-time seed.
INSERT INTO business_affiliate_links
  (slug, name, category, tagline, description, why_i_use_it, how_it_helps_you, affiliate_url, cta_label, icon, accent, badge, sort_order)
VALUES
  ('stripe', 'Stripe', 'Payments',
   'Take card payments the day you open.',
   'Stripe is the payments backbone for online businesses — cards, Apple Pay, Google Pay and payouts straight to your bank.',
   'Every sale on CardPop settles through Stripe. It handles checkout, fraud screening and payouts so we can focus on the marketplace instead of plumbing.',
   'Whether you sell at shows, on socials or from a spare-room stockpile, Stripe lets you take real card payments without a merchant bank. Add Payment Links or a hosted checkout to your own store in an afternoon and get paid straight to your account.',
   'https://stripe.com/au', 'Explore Stripe', 'CreditCard', 'from-indigo-500 to-purple-600',
   'Powers CardPop checkout', 10),

  ('google-workspace', 'Google Workspace', 'Productivity',
   'A professional inbox on your own domain.',
   'Gmail, Drive, Docs, Sheets and Meet running on your business domain — the day-to-day toolkit that makes a one-person operation look and run like a real company.',
   'CardPop runs on Google Workspace — you@cardpop.com.au inboxes, shared Drives for supplier docs, and Sheets for stock and reconciliation.',
   'Swapping a personal gmail for you@yourshop.com.au instantly lifts how buyers, suppliers and event organisers see you. Track inventory in Sheets, store show receipts in Drive, and never lose a customer email again.',
   'https://workspace.google.com/', 'Explore Workspace', 'Briefcase', 'from-blue-500 to-cyan-600',
   NULL, 20),

  ('whatnot', 'Whatnot', 'Live selling',
   'Sell live to buyers who came to spend.',
   'Whatnot is the fastest-growing live-selling platform for trading cards — run auctions and breaks to an audience that turns up ready to buy.',
   'We point the CardPop community to Whatnot for live selling because the format moves stock fast and builds a following in a way static listings can''t.',
   'Live shows are the single best way to shift volume and build regulars. Run a weekly break or pack-rip, repeat your CardPop and socials handle on stream, and funnel that audience back to your marketplace listings between shows.',
   'https://www.whatnot.com/', 'Explore Whatnot', 'Radio', 'from-green-500 to-emerald-600',
   NULL, 30),

  ('facebook', 'Facebook & Instagram', 'Social',
   'Where local card buyers already hang out.',
   'A Facebook Page plus Instagram is the free shopfront for a card business — groups, Marketplace, Stories and Reels put your stock in front of local collectors daily.',
   'CardPop uses Meta''s platforms to reach collectors where they already scroll, and to send that traffic to listings and shows.',
   'Post your show table, your latest pulls and your restocks to build a local following that buys again and again. Join the buy/sell/trade groups, run the odd boosted post, and treat every sale as a follower you keep for the next drop.',
   'https://www.facebook.com/business', 'Explore Meta for Business', 'Facebook', 'from-blue-600 to-indigo-600',
   NULL, 40),

  ('kit', 'Kit (formerly ConvertKit)', 'Email & content',
   'Own your audience across content, ads, dev and data.',
   'Kit is a creator operating system that does far more than send email. Content management: build landing pages, sign-up forms and a public newsletter hub, and write broadcasts in a proper editor. Digital advertising: the Creator Network and paid Recommendations put your newsletter in front of other creators'' audiences, and sponsorships let you earn from yours. Development: a full API v4, webhooks and an MCP server mean you can automate sign-ups, tag buyers and wire Kit into your own store. Analytics: open and click rates, link tracking, growth stats and per-subscriber engagement show exactly what''s working.',
   'CardPop''s newsletter runs on Kit. It''s the one channel we own outright — no algorithm deciding who sees our restocks and launches — and we lean on all of it: forms and landing pages to capture sign-ups (content), the Creator Network to grow reach (advertising), the API to sync buyers automatically (development), and the click and growth stats to see which drops land (analytics).',
   'Socials can throttle your reach overnight; an email list can''t. Use Kit''s forms and landing pages to capture emails at your show table and in your bio (content management), grow that list through the Creator Network and recommendations (digital advertising), automate tagging and welcome sequences through its API and webhooks (development), and read the open, click and growth analytics to double down on the drops your buyers actually want. It''s the audience nobody can take away from you.',
   'https://kit.com/', 'Explore Kit', 'Mail', 'from-pink-500 to-rose-600',
   'Powers our newsletter', 50)
ON CONFLICT (slug) DO NOTHING;
