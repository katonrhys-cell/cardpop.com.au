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

/** Card shop → Admin → Store Directory, store editor open. */
export const adminStorePath = (slug) => (slug ? `/admin/store-directory?edit=${enc(slug)}` : null);
