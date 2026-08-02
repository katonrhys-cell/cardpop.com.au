// Identification is a deliberate step in the listing flow, not something that
// fires off the first photo.
//
// It used to auto-run the moment a seller dropped a photo onto a new card. That
// made the *front* the whole read, and the front is the weaker half of the card:
// the set code, collector number and release year are frequently printed only on
// the back. The pipeline has always accepted several images — the auto-run just
// guaranteed it never got them, because it fired before the seller had a chance
// to add any. The visible symptom was the back-photo prompt in the results panel
// (`utils/backPhotoPrompt.js`): read the front, notice the year is missing, then
// ask the seller to add the back and identify *again* — two model calls to reach
// what one call with two photos would have answered.
//
// So the seller now assembles their photos and presses the button. One read, all
// the evidence. See `docs/card-identification.md`.

// How many images an identification request sends. The front is always first;
// extras are added in slot order and trimmed from the back if the payload is too
// large (`utils/analysisImage.js`). Shared so the UI copy, the payload builder
// and the OCR hook can't disagree about the number.
export const ANALYSIS_IMAGE_LIMIT = 3;

/**
 * How many of the seller's photos an identification would actually send.
 *
 * Zero without a front photo, even when extra slots are filled: the request is
 * built as `[front, ...extras]` and bails out with no front, so counting the
 * extras would offer a button that does nothing.
 *
 * @param {File|null|undefined} front
 * @param {Array<File|null|undefined>} extras
 * @returns {number}
 */
export const analysisPhotoCount = (front, extras = []) => {
  if (!front) return 0;
  const filledExtras = Array.isArray(extras) ? extras.filter(Boolean).length : 0;
  return Math.min(1 + filledExtras, ANALYSIS_IMAGE_LIMIT);
};

/**
 * The label and hint for the Identify button.
 *
 * The hint is the whole point of making this manual: with one photo loaded it
 * says the back is worth adding *before* spending the read, which is the advice
 * the old flow could only give afterwards.
 *
 * @param {object} args
 * @param {number} args.photoCount          - photos that would be sent now
 * @param {number} [args.analysedImageCount] - photos the last read used (0 = none yet)
 * @returns {{ label: string, hint: string, stale: boolean }|null}
 *   null when there is nothing to identify.
 */
export const identifyCallToAction = ({ photoCount, analysedImageCount = 0 }) => {
  if (!photoCount) return null;

  const withCount = `${photoCount} photo${photoCount === 1 ? '' : 's'}`;
  const hasRun = Number(analysedImageCount) > 0;

  if (!hasRun) {
    return {
      label: photoCount === 1 ? 'Identify Card' : `Identify Card from ${withCount}`,
      hint: photoCount === 1
        ? 'Add a photo of the back first if you can — the set code, card number and year are usually printed only on the back.'
        : `Reads all ${withCount} together, so details printed on the back are picked up too.`,
      stale: false,
    };
  }

  // Photos added since the last read are evidence the read didn't have.
  if (photoCount > Number(analysedImageCount)) {
    return {
      label: `Identify Again with ${withCount}`,
      hint: "You've added photos since the last read — run it again to use them.",
      stale: true,
    };
  }

  return {
    label: 'Identify Again',
    hint: `Last read used ${analysedImageCount} photo${Number(analysedImageCount) === 1 ? '' : 's'}.`,
    stale: false,
  };
};

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
