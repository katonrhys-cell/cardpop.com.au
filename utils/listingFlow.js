// Photo-first listing flow: when a seller adds their first photo to a NEW
// card, identification (CardSight catalog → OCR fallback) runs automatically —
// it's the default path, not an opt-in button. This guard decides when the
// auto-run is appropriate:
//   - never in edit mode (the card's details already exist)
//   - never over a card name the seller (or a previous run) already filled in,
//     so re-picking a photo can't clobber work and each card costs at most one
//     automatic AI call
//   - never while an analysis is already in flight
export const shouldAutoIdentify = ({ isEdit, cardName, isScanning, isIdentifying }) =>
  !isEdit && !cardName?.trim() && !isScanning && !isIdentifying;
