// Vendor information on an event (events.vendor_info + vendor_application_url).
// Everything a would-be trader needs: a few words from the organiser, the
// vendor FAQ, downloadable documents (trader pack PDF, floor plan) and links
// (the organiser's own vendor page, their FAQ page). Dependency-free so the
// event form, the event page and api/prerender.js read the same shape.
//
// Stored shape: { intro, faqs: [{ question, answer }],
//                 documents: [{ title, url }], links: [{ label, url }] }
// — list order is display order.

export const MAX_VENDOR_INTRO_CHARS = 3000;
export const MAX_VENDOR_FAQS = 30;
export const MAX_VENDOR_QUESTION_CHARS = 200;
export const MAX_VENDOR_ANSWER_CHARS = 2000;
export const MAX_VENDOR_DOCUMENTS = 10;
export const MAX_VENDOR_LINKS = 6;
export const MAX_VENDOR_TITLE_CHARS = 100;

// The page section's anchor — "Want to be a vendor?" links here.
export const VENDOR_INFO_ANCHOR = 'vendor-info';

const trimOrEmpty = (v) => (typeof v === 'string' ? v.trim() : '');

// http(s) only — a stored "javascript:" link must never become an href.
export const safeVendorUrl = (v) => {
  const s = trimOrEmpty(v);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
};

export const emptyVendorFaq = () => ({ question: '', answer: '' });
export const emptyVendorLink = () => ({ label: '', url: '' });

/** A document's link points at a PDF (shown with a file icon, opened in a new tab). */
export const isPdfUrl = (url) => /\.pdf(?:$|[?#])/i.test(trimOrEmpty(url));
/** A document's link points at an image (shown as a thumbnail). */
export const isImageUrl = (url) => /\.(?:jpe?g|png|webp|gif)(?:$|[?#])/i.test(trimOrEmpty(url));

/** The name shown for a document with no title: its file name, else "Document n". */
const fallbackTitle = (url, i) => {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    // Uploaded files are stored under a random id — not a name worth showing.
    if (last && !/^[0-9a-f-]{20,}\.[a-z0-9]+$/i.test(last)) return last.slice(0, MAX_VENDOR_TITLE_CHARS);
  } catch { /* fall through */ }
  return isPdfUrl(url) ? `Vendor document ${i + 1}` : `Vendor image ${i + 1}`;
};

/**
 * Normalise whatever the DB (or the form) holds: text trimmed and capped, a
 * FAQ needs a question and an answer, a document or link needs a usable
 * http(s) URL (a link without a label is called "More vendor info").
 * Always returns { intro, faqs, documents, links }.
 */
export const cleanVendorInfo = (raw) => {
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const list = (x) => (Array.isArray(x) ? x : []);
  const faqs = list(v.faqs)
    .map((f) => ({
      question: trimOrEmpty(f?.question).slice(0, MAX_VENDOR_QUESTION_CHARS),
      answer: trimOrEmpty(f?.answer).slice(0, MAX_VENDOR_ANSWER_CHARS),
    }))
    .filter((f) => f.question && f.answer)
    .slice(0, MAX_VENDOR_FAQS);
  const documents = list(v.documents)
    .map((d) => ({ title: trimOrEmpty(d?.title).slice(0, MAX_VENDOR_TITLE_CHARS), url: safeVendorUrl(d?.url) }))
    .filter((d) => d.url)
    .slice(0, MAX_VENDOR_DOCUMENTS)
    .map((d, i) => ({ ...d, title: d.title || fallbackTitle(d.url, i) }));
  const links = list(v.links)
    .map((l) => ({ label: trimOrEmpty(l?.label).slice(0, MAX_VENDOR_TITLE_CHARS), url: safeVendorUrl(l?.url) }))
    .filter((l) => l.url)
    .slice(0, MAX_VENDOR_LINKS)
    .map((l) => ({ ...l, label: l.label || 'More vendor info' }));
  return { intro: trimOrEmpty(v.intro).slice(0, MAX_VENDOR_INTRO_CHARS), faqs, documents, links };
};

/** Whether the event has anything at all for vendors (info or an application link). */
export const hasVendorInfo = (info, applicationUrl = '') => {
  const c = cleanVendorInfo(info);
  return Boolean(c.intro || c.faqs.length || c.documents.length || c.links.length || safeVendorUrl(applicationUrl));
};

/** Stored vendor info → the editor's rows (documents are { title, url } saved, or { title, file, name } picked). */
export const vendorInfoToForm = (raw) => {
  const c = cleanVendorInfo(raw);
  return {
    intro: c.intro,
    faqs: c.faqs,
    documents: c.documents,
    links: c.links,
  };
};

export const emptyVendorForm = () => ({ intro: '', faqs: [], documents: [], links: [] });

/**
 * Form-side check before saving (rows as the editor holds them): a half-filled
 * FAQ, or a link that isn't a usable web address. Returns a message or null.
 * Links should already have been through normalizeEventUrl.
 */
export const vendorInfoFormError = (form) => {
  for (const [i, f] of (form?.faqs || []).entries()) {
    const q = trimOrEmpty(f?.question);
    const a = trimOrEmpty(f?.answer);
    if (q && !a) return `Vendor FAQ ${i + 1} ("${q}") needs an answer — or remove it.`;
    if (a && !q) return `Vendor FAQ ${i + 1} needs a question — or remove it.`;
  }
  for (const [i, l] of (form?.links || []).entries()) {
    const url = trimOrEmpty(l?.url);
    if (!url && trimOrEmpty(l?.label)) return `Vendor link ${i + 1} ("${trimOrEmpty(l.label)}") needs a web address — or remove it.`;
    if (url && !safeVendorUrl(url)) return `Vendor link ${i + 1} must be a full web address (https://…).`;
  }
  return null;
};
