/**
 * Where an admin goes to edit the thing a public page is showing.
 *
 * The admin screens read these query params on arrival and open the item's
 * editor straight away (see ProductManagementPage, EventsManagementPage,
 * ListingsManagementPage). Dependency-free so a test can pin the shapes.
 */

const enc = encodeURIComponent;

/** Shop product → Admin → Products, product form open. */
export const adminShopProductPath = (id) => (id ? `/admin/products?edit=${enc(id)}` : null);

/** Event → Admin → Events, event form open. */
export const adminEventPath = (id) => (id ? `/admin/events?edit=${enc(id)}` : null);

/** Marketplace listing → Admin → All Listings, listing dialog open. */
export const adminListingPath = (id) => (id ? `/admin/all-listings?listing=${enc(id)}` : null);

/**
 * Admin → Products as a flat list for one shop category / section (the names
 * as stored: a category's `name`, a section's `label`). No arguments = all.
 */
export const adminProductsPath = ({ category, section } = {}) => {
  const q = new URLSearchParams();
  if (category) q.set('category', category);
  else if (section) q.set('section', section);
  if (category || section) q.set('view', 'list');
  const qs = q.toString();
  return `/admin/products${qs ? `?${qs}` : ''}`;
};

/** Admin → Products with the Categories manager (add / remove categories) open. */
export const adminShopCategoriesPath = () => '/admin/products?categories=1';

/** Blog article → Admin → Content, article editor open. */
export const adminArticlePath = (id) => (id ? `/admin/content?edit=${enc(id)}` : null);

/** Event review (a blog article with a scorecard) → its own full-page editor. */
export const adminEventReviewPath = (reviewId) => (reviewId ? `/admin/event-reviews/${enc(reviewId)}` : null);

/** Player → Admin → Players, player form open. */
export const adminPlayerPath = (id) => (id ? `/admin/players?edit=${enc(id)}` : null);

/** A member (seller / dealer profile) → Admin → Users → that user's page. */
export const adminUserPath = (id) => (id ? `/admin/users/${enc(id)}` : null);

/** Giveaway → Admin → Giveaways, giveaway form open. */
export const adminGiveawayPath = (id) => (id ? `/admin/giveaways?edit=${enc(id)}` : null);

/** Admin screens that manage a whole public page's list (no single item to open). */
export const ADMIN_LISTS = {
  whatnotShows: '/admin/whatnot-shows',
  storeDirectory: '/admin/store-directory',
  partners: '/admin/partners',
  collections: '/admin/collections',
};

/** Card shop → Admin → Store Directory, store editor open. */
export const adminStorePath = (slug) => (slug ? `/admin/store-directory?edit=${enc(slug)}` : null);
