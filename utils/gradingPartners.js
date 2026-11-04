// Pure helpers for the grading submission partners (the Australian stores and
// services that submit cards to PSA, Beckett, CGC, ACE, SGC or TAG). Dependency-free
// apart from the companies list so api/prerender.js can share them.
import { GRADING_COMPANIES, findGradingCompany } from '../data/gradingCompanies.js';

export const GRADING_PARTNERS_PATH = '/grading/submission-partners';
export const COMPANY_PARAM = 'company';

/** The lower-case company keys the `companies` column may hold. */
export const PARTNER_COMPANY_KEYS = GRADING_COMPANIES.map((g) => g.key.toLowerCase());

/** 'PSA' | 'psa ' → 'psa'; anything unknown → null. */
export function normaliseCompanyKey(value) {
  const k = String(value || '').trim().toLowerCase();
  return PARTNER_COMPANY_KEYS.includes(k) ? k : null;
}

/** The company entry for a lower-case key, or null. */
export function companyForKey(key) {
  const k = normaliseCompanyKey(key);
  return k ? findGradingCompany(k) : null;
}

/**
 * Where "Grade with <company>" sends people: the partners page filtered to that
 * company (`/grading/submission-partners?company=psa`), or the page itself.
 */
export function gradingPartnersPath(companyKey) {
  const k = normaliseCompanyKey(companyKey);
  return k ? `${GRADING_PARTNERS_PATH}?${COMPANY_PARAM}=${k}` : GRADING_PARTNERS_PATH;
}

const HTTP = /^https?:\/\//i;

/** Hostname for a favicon lookup: 'https://www.slabbys.com.au/x' → 'slabbys.com.au'. */
export function partnerDomain(website) {
  try {
    return new URL(String(website || '')).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The partner's page for this company when it has one, else its website. */
export function partnerLinkFor(partner, companyKey) {
  const k = normaliseCompanyKey(companyKey);
  const link = k && partner?.company_links && partner.company_links[k];
  return typeof link === 'string' && HTTP.test(link) ? link : partner?.website || '#';
}

/** Lower-case, known, de-duplicated company keys in the order given. */
export function cleanCompanies(list) {
  const out = [];
  for (const v of Array.isArray(list) ? list : []) {
    const k = normaliseCompanyKey(v);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Keep only http(s) links under known company keys. */
export function cleanCompanyLinks(links) {
  const out = {};
  if (!links || typeof links !== 'object') return out;
  for (const [key, url] of Object.entries(links)) {
    const k = normaliseCompanyKey(key);
    const u = String(url || '').trim();
    if (k && HTTP.test(u)) out[k] = u;
  }
  return out;
}

/** 'TCG, Sports Cards,,AFL' → ['TCG', 'Sports Cards', 'AFL']. */
export function parseCategories(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const out = [];
  for (const v of list) {
    const s = String(v || '').trim();
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

/** 'Cherry Collectables' → 'cherry-collectables' (the DB's slug constraint). */
export function gradingPartnerSlug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function byOrder(a, b) {
  return (a.sort_order ?? 100) - (b.sort_order ?? 100) || String(a.name).localeCompare(String(b.name));
}

/** Active partners that submit to `companyKey` (all active partners when no key), in display order. */
export function partnersForCompany(partners, companyKey) {
  const k = normaliseCompanyKey(companyKey);
  return (Array.isArray(partners) ? partners : [])
    .filter((p) => p && p.is_active !== false && (!k || cleanCompanies(p.companies).includes(k)))
    .sort(byOrder);
}

/** { psa: 5, bgs: 5, … } — how many active partners submit to each company. */
export function partnerCountsByCompany(partners) {
  const counts = Object.fromEntries(PARTNER_COMPANY_KEYS.map((k) => [k, 0]));
  for (const p of Array.isArray(partners) ? partners : []) {
    if (!p || p.is_active === false) continue;
    for (const k of cleanCompanies(p.companies)) counts[k] += 1;
  }
  return counts;
}

/** One line per partner for the bot-rendered copy of the page. */
export function partnerLineText(partner) {
  const where = partner.location ? `, ${partner.location}` : '';
  const desc = partner.description ? ` — ${partner.description}` : '';
  return `${partner.name}${where}${desc}`;
}
