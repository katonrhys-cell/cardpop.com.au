// The admin dashboard's directory: every admin screen, grouped by the job it
// does. One list, so the dashboard, its search box and the tests agree.
//
// To add a screen: add its <Route> under /admin in App.jsx, then one entry in
// the group it belongs to. `keywords` are extra words the search box matches
// (what an admin might type when they don't remember the screen's name).
// tests/frontend/adminSections.test.js fails when an entry points at a path
// with no route, or when a routed screen is missing from this list.
import {
  ShoppingCart, ShoppingBag, MessageSquareText, TicketPercent,
  ListOrdered, HandCoins, CreditCard, FileText, DollarSign, Calculator, Percent,
  Store, LayoutList, Users, Image, Star, ShieldCheck, Flag, MessagesSquare,
  FolderTree, Layers2, Building2, Layers, Library, Map,
  Calendar, ClipboardPen, Megaphone, Mail, Tv2,
  MapPin, Briefcase, Award, Handshake, Rocket,
  Newspaper, Gift, Sparkles, Shapes, Images,
  BarChart3, Wrench, Settings, Wallet, CalendarDays, UserCheck, Trophy, Tags, Package,
} from 'lucide-react';

export const ADMIN_SECTIONS = [
  {
    id: 'shop',
    title: 'Shop',
    summary: 'The CardPop store: products, reviews and discounts.',
    icon: ShoppingCart,
    items: [
      { title: 'Products', description: 'Add, edit, price and stock shop products.', link: '/admin/products', icon: Package, keywords: 'shop management stock sku inventory bulk import categories supplier preorder' },
      { title: 'Product Reviews', description: 'Approve verified-purchase reviews.', link: '/admin/product-reviews', icon: MessageSquareText, keywords: 'shop ratings moderation' },
      { title: 'Promo Codes', description: 'Create % off codes and see every use.', link: '/admin/promo-codes', icon: TicketPercent, keywords: 'discount coupon voucher' },
      { title: 'Affiliate Products', description: 'Amazon products shown under shop pages.', link: '/admin/shop-affiliate-products', icon: ShoppingBag, keywords: 'shop affiliate amazon' },
    ],
  },
  {
    id: 'orders',
    title: 'Orders & Money',
    summary: 'Sales, payments, fees and tax.',
    icon: Wallet,
    items: [
      { title: 'Orders', description: 'Track, ship and manage every order.', link: '/admin/orders', icon: ListOrdered, keywords: 'order management shipping tracking refunds' },
      { title: 'Offers', description: 'Marketplace offers: open, unpaid, paid, lapsed.', link: '/admin/offers', icon: HandCoins, keywords: 'enquiries counter' },
      { title: 'Chargebacks', description: 'Payment disputes and frozen payouts.', link: '/admin/disputes', icon: CreditCard, keywords: 'disputes stripe' },
      { title: 'Invoices', description: 'Tax invoices, credit notes and Xero exports.', link: '/admin/invoices', icon: FileText, keywords: 'xero pdf credit note abn' },
      { title: 'Revenue Breakdown', description: 'Every sale behind total revenue.', link: '/admin/revenue', icon: DollarSign, keywords: 'sales ledger income' },
      { title: 'Finance & Tax', description: 'Profit, GST by BAS quarter, stock value.', link: '/admin/finance', icon: Calculator, keywords: 'bas gst accountant cogs ai spend p&l' },
      { title: 'Commissions & Fees', description: 'Set fee rates and the processing fee.', link: '/admin/commissions', icon: Percent, keywords: 'commission settings revenue rates' },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace & Cards',
    summary: 'Member listings and how cards are shown.',
    icon: Store,
    items: [
      { title: 'Marketplace', description: 'Listing overview and marketplace health.', link: '/admin/marketplace', icon: Store, keywords: 'listings' },
      { title: 'All Listings', description: 'Find and edit any member listing.', link: '/admin/all-listings', icon: Tags, keywords: 'listings cards edit vault' },
      { title: 'Players', description: 'Player pages: bios, key cards, aliases.', link: '/admin/players', icon: Trophy, keywords: 'athletes sports' },
      { title: 'Card Art', description: 'Card thumbnails and art overrides.', link: '/admin/card-art', icon: Image, keywords: 'images thumbnails analytics' },
      { title: 'Collection Sections', description: 'Pin cards to collection page strips.', link: '/admin/collection-sections', icon: LayoutList, keywords: 'featured strips' },
    ],
  },
  {
    id: 'catalogue',
    title: 'Card Catalogue',
    summary: 'The category, brand and set pickers.',
    icon: FolderTree,
    items: [
      { title: 'Categories', description: 'Categories, franchises, sets and parallels.', link: '/admin/categories', icon: FolderTree, keywords: 'category management franchise manufacturers sets' },
      { title: 'Subcategories', description: 'Nested subcategories.', link: '/admin/subcategories', icon: Layers2, keywords: 'subcategory management' },
      { title: 'Brands', description: 'Game and sports brands.', link: '/admin/brands', icon: Building2, keywords: 'brands management manufacturers' },
      { title: 'Product Lines', description: 'Product lines per brand.', link: '/admin/product-lines', icon: Layers, keywords: '' },
      { title: 'Collections & Eras', description: 'Eras and sets per collection.', link: '/admin/collections', icon: Library, keywords: 'sets' },
      { title: 'Category Mapping', description: 'Map categories to collections.', link: '/admin/category-mapping', icon: Map, keywords: '' },
    ],
  },
  {
    id: 'members',
    title: 'Members & Safety',
    summary: 'Accounts, sellers and moderation.',
    icon: Users,
    items: [
      { title: 'Users', description: 'Accounts, roles and memberships.', link: '/admin/users', icon: Users, keywords: 'user management members admins accounts' },
      { title: 'Sellers', description: 'Featured sellers and promotions.', link: '/admin/sellers', icon: Star, keywords: 'sellers management' },
      { title: 'Verification', description: 'Review ID verification requests.', link: '/admin/verification', icon: ShieldCheck, keywords: 'identity id kyc' },
      { title: 'Reports & Moderation', description: 'Scam, counterfeit and abuse reports.', link: '/admin/reports', icon: Flag, keywords: 'flagged fraud' },
      { title: 'Chat Moderation', description: 'Search and review member conversations.', link: '/admin/messages', icon: MessagesSquare, keywords: 'messages inbox' },
    ],
  },
  {
    id: 'events',
    title: 'Events',
    summary: 'Shows, organisers and reviews.',
    icon: CalendarDays,
    items: [
      { title: 'Events', description: 'Approve, create and edit events.', link: '/admin/events', icon: Calendar, keywords: 'events management calendar shows scan featured' },
      { title: 'Event Reviews', description: 'Write up the shows CardPop attends.', link: '/admin/event-reviews', icon: ClipboardPen, keywords: 'articles scorecard' },
      { title: 'Organiser Requests', description: 'Confirm members who run events.', link: '/admin/organiser-requests', icon: UserCheck, keywords: 'organizer access applications' },
      { title: 'Organiser Messages', description: 'Held messages and unclaimed pages.', link: '/admin/organiser-messages', icon: Mail, keywords: 'organizer feedback screened' },
      { title: 'Whatnot Shows', description: 'Moderate member-listed live shows.', link: '/admin/whatnot-shows', icon: Tv2, keywords: 'live streams' },
    ],
  },
  {
    id: 'directories',
    title: 'Directories & Partners',
    summary: 'Card shops, storefronts and partners.',
    icon: MapPin,
    items: [
      { title: 'Store Directory', description: 'Card shop pages and owner requests.', link: '/admin/store-directory', icon: MapPin, keywords: 'card shops local game stores owners map' },
      { title: 'Business Profiles', description: 'Retail storefronts in the directory.', link: '/admin/business-profiles', icon: Briefcase, keywords: 'retailers storefront' },
      { title: 'Grading Partners', description: 'Stores that submit to PSA, BGS, CGC…', link: '/admin/grading-partners', icon: Award, keywords: 'psa beckett cgc ace sgc tag submission' },
      { title: 'Partner Program', description: 'Applications, rates and commissions.', link: '/admin/partners', icon: Handshake, keywords: 'affiliates partner codes' },
      { title: 'Building Your Business', description: 'Affiliate tools on the business page.', link: '/admin/building-your-business', icon: Rocket, keywords: 'affiliate links community' },
    ],
  },
  {
    id: 'content',
    title: 'Content & Marketing',
    summary: 'Articles, giveaways and site imagery.',
    icon: Megaphone,
    items: [
      { title: 'Blog & Articles', description: 'Edit blog posts, pages and articles.', link: '/admin/content', icon: Newspaper, keywords: 'content management parallel report drafts' },
      { title: 'Giveaways', description: 'Prizes, entries and the recorded draw.', link: '/admin/giveaways', icon: Gift, keywords: 'instagram competition' },
      { title: 'Hero Showcase', description: 'Cards in the homepage hero.', link: '/admin/hero-showcase', icon: Sparkles, keywords: 'homepage animation' },
      { title: 'Menu Icons', description: 'Icons in the header dropdown menus.', link: '/admin/menu-icons', icon: Shapes, keywords: 'navigation header' },
      { title: 'Media Library', description: 'Upload and manage images.', link: '/admin/media', icon: Images, keywords: 'photos uploads' },
    ],
  },
  {
    id: 'system',
    title: 'Site & System',
    summary: 'Analytics, health and settings.',
    icon: Settings,
    items: [
      { title: 'Analytics & Reports', description: 'Platform analytics.', link: '/admin/analytics', icon: BarChart3, keywords: 'stats traffic' },
      { title: 'System Diagnostics', description: 'Monitor system health.', link: '/admin/diagnostics', icon: Wrench, keywords: 'health status errors' },
      { title: 'Admin Settings', description: 'Platform-wide settings.', link: '/admin/settings', icon: Settings, keywords: 'configuration maintenance announcement limits' },
    ],
  },
];

const norm = (s) => String(s || '').toLowerCase().trim();

// Sections narrowed to the entries matching every word of the query (in the
// title, description, keywords or the section's own name). Empty query = all.
export const filterAdminSections = (query, sections = ADMIN_SECTIONS) => {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return sections;
  return sections
    .map((section) => {
      const items = section.items.filter((item) => {
        const haystack = norm(`${item.title} ${item.description} ${item.keywords} ${section.title}`);
        return words.every((w) => haystack.includes(w));
      });
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
};
