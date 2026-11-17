// Who operates CardPop — the legal name and ABN shown to visitors on About,
// Contact, the Terms of Service and the site footer.
//
// One source: the `invoice_supplier_details` platform setting an admin edits at
// Admin → Invoices → Invoice details (the same name and ABN printed on every
// tax invoice). Only the legal name and the ABN are ever published — the
// setting's address, phone, email and footer note stay private — and an ABN is
// published only when it passes the ATO checksum, so a half-typed number can
// never reach a public page. Dependency-free: the SPA, src/routes/settings.js
// and api/prerender.js all use it.

import { formatAbn, isValidAbn } from './abn.js';

const BRAND = 'CardPop Australia™';

/** The stored setting → `{ legal_name, abn }` (each a string or ''). */
export function cleanBusinessIdentity(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const legalName = String(s.legal_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const abn = isValidAbn(s.abn) ? formatAbn(s.abn) : '';
  return { legal_name: legalName, abn };
}

/** True when there is an ABN to show. */
export function hasBusinessIdentity(identity) {
  return Boolean(cleanBusinessIdentity(identity).abn);
}

/**
 * "CardPop Australia™ is operated by Example Pty Ltd (ABN 51 824 753 556)."
 * — or null until an ABN has been entered.
 */
export function businessIdentityLine(identity) {
  const { legal_name: legalName, abn } = cleanBusinessIdentity(identity);
  if (!abn) return null;
  // A legal name that is just the brand again adds nothing: say the ABN only.
  const named = legalName && !/^cardpop(\s+australia)?™?$/i.test(legalName);
  return named
    ? `${BRAND} is operated by ${legalName} (ABN ${abn}).`
    : `${BRAND} — ABN ${abn}.`;
}

/** The short footer form: "Example Pty Ltd · ABN 51 824 753 556", or null. */
export function businessIdentityShort(identity) {
  const { legal_name: legalName, abn } = cleanBusinessIdentity(identity);
  if (!abn) return null;
  const named = legalName && !/^cardpop(\s+australia)?™?$/i.test(legalName);
  return named ? `${legalName} · ABN ${abn}` : `ABN ${abn}`;
}

/** The platform_settings key the identity is stored under. */
export const BUSINESS_IDENTITY_KEY = 'invoice_supplier_details';
