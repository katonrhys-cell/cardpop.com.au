-- Fill in the Collect-It Con: Trading Cards Edition 2026 draft (event
-- 8b396d0f-a888-49a2-bd11-e527a765e977) from the organiser's media release:
-- SEO fields, corrected venue/address, event page, organiser contact and
-- Facebook link. Data only; the row stays pending_review for an admin to
-- approve. Scoped to that id and status, so it is a no-op if the event was
-- already approved, edited out of review, or deleted.
update public.events set
  facebook_url      = 'https://www.facebook.com/share/1Pi9wbtDMB/',
  venue_name        = 'Brandon Office Park — Level 1, Building 1',
  address           = '530–540 Springvale Rd',
  website_url       = 'https://collectitcon.com.au/2026-trading-card-edition',
  organizer_name    = 'Collect-It Con',
  organizer_email   = 'info@collectitcon.com.au',
  short_description = 'A one-day convention in Glen Waverley just for trading cards: 60+ vendors across TCG and sports cards, a community area, and VIP early entry from 9am.',
  description       = E'Collect-It Con is back in November with a Trading Cards Edition, a one-day show in Glen Waverley, in Melbourne''s south-east, given over entirely to TCG, sports cards and the wider card hobby. It follows the organisers'' sold-out May event. The annual flagship Collect-It Con covers collectables broadly and runs competitive TCG tournaments; this edition is built for card collectors, traders and hobbyists.\n\nThe show has more than 60 curated vendor spaces and a dedicated community area for TCG and sports card collectors, so you can buy, sell, trade and meet other collectors.\n\nDoors open to general admission at 10:00am and close at 4:00pm. VIP ticket holders get in an hour early, from 9:00am.\n\nTickets:\n- GA (all day): $15\n- GA (after 1pm): $10\n- VIP (1hr early access): $25\n- Group of 4: $50\n\nTickets are sold through Eventbrite.',
  seo_title         = 'Collect-It Con Trading Cards Edition 2026 | Glen Waverley',
  seo_description   = 'Collect-It Con Trading Cards Edition, Sat 14 Nov 2026, Glen Waverley VIC. 60+ TCG & sports card vendors, 10am–4pm, VIP 9am. Tickets from $10.',
  seo_keywords      = array[
    'Collect-It Con',
    'Collect-It Con Trading Cards Edition',
    'trading card show Melbourne',
    'card show Glen Waverley',
    'TCG convention Victoria',
    'sports card show Melbourne',
    'Pokemon card show Melbourne',
    'trading card events November 2026'
  ],
  updated_at        = now()
where id = '8b396d0f-a888-49a2-bd11-e527a765e977'
  and status = 'pending_review';
