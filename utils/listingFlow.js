// Photo-first listing flow: when a seller adds their first photo to a NEW
// card, identification (CardSight catalog → OCR fallback) runs automatically —
// it's the default path, not an opt-in button. This guard decides when the
// auto-run is appropriate:
//   - never in edit mode (the card's details already exist)
//   - never over a card name the seller (or a previous run) already filled in,
//     so re-picking a photo can't clobber work and each card costs at most one
//     automatic AI call
//   - never while an analysis is already in flight
// `isPreparingImage` covers the card-rectification step that runs before either
// model is called — without it, swapping photos mid-preparation starts a second
// analysis that races the first.
export const shouldAutoIdentify = ({ isEdit, cardName, isScanning, isIdentifying, isPreparingImage }) =>
  !isEdit && !cardName?.trim() && !isScanning && !isIdentifying && !isPreparingImage;

// Form grading values → the service names the eBay price-estimate endpoint
// expects in its query. 'raw' (ungraded) and 'other' (unrecognised service)
// intentionally have no mapping — the lookup then omits grading terms.
export const GRADING_SERVICE_QUERY = { psa: 'PSA', bgs: 'BGS', cgc: 'CGC', sgc: 'SGC', ace: 'ACE' };

// Build the query object useEbayPriceLookup expects (its shape comes from OCR
// results) out of manually-typed form fields, so a seller can get a price
// estimate on demand without ever running an AI identify.
export const buildPriceLookupQuery = (formData) => {
  const name = formData?.cardName?.trim();
  if (!name) return null;
  return {
    name,
    cardSetName: formData.setName?.trim() || undefined,
    gradingService: GRADING_SERVICE_QUERY[formData.gradingCompany] ?? 'None',
    gradeScore: formData.grade?.trim() || undefined,
  };
};
