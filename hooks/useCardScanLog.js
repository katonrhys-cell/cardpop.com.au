import { useState, useCallback } from 'react';
import { apiServerClient } from '@/lib/apiServerClient';

/**
 * Records identifications so a catalogue can accumulate out of them.
 *
 * Entirely fire-and-forget. Logging is bookkeeping behind a scan that has
 * already succeeded for the seller, so nothing here is allowed to surface an
 * error, block a save, or slow the form down — every failure is swallowed after
 * a console warning.
 *
 *   record(result)  — after an identification; keeps the scan id
 *   confirm(fields) — after the listing saves, with what the seller kept
 */
export function useCardScanLog() {
  const [scanId, setScanId] = useState(null);

  const record = useCallback(async (payload) => {
    if (!payload) return null;
    try {
      const res = await apiServerClient.fetch('/card-scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const { id } = await res.json();
      setScanId(id ?? null);
      return id ?? null;
    } catch (err) {
      console.warn('[useCardScanLog] could not record scan:', err.message);
      return null;
    }
  }, []);

  /**
   * Attaches the values the seller actually saved. The diff against what was
   * identified is the accuracy signal; an unchanged identity is a human
   * confirming the catalogue entry.
   */
  const confirm = useCallback(async (savedFields, vaultItemId) => {
    if (!scanId) return;
    try {
      await apiServerClient.fetch(`/card-scans/${scanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedFields, vaultItemId: vaultItemId ?? null }),
      });
    } catch (err) {
      console.warn('[useCardScanLog] could not attach saved fields:', err.message);
    }
  }, [scanId]);

  return { record, confirm, scanId, clearScanLog: () => setScanId(null) };
}

/**
 * Flattens an identification into the log payload.
 *
 * `ocr` keeps the whole read verbatim — the columns beside it are for querying,
 * but a field we haven't thought to extract yet is only recoverable if the raw
 * result was kept.
 */
export function buildScanPayload({ ocr, cardSight, imageCount, variants }) {
  const cs = cardSight?.identified ? cardSight : null;
  return {
    imageCount,
    ocr,
    // Prefer a trustworthy catalog match over the raw read for identity, which
    // mirrors what the form itself does.
    collection: ocr?.collectionType || null,
    setName: cs?.card?.setName || ocr?.cardSetName || null,
    insertName: ocr?.insertName || null,
    cardNumber: ocr?.cardNumber || cs?.card?.cardNumber || null,
    cardName: cs?.card?.name || ocr?.name || null,
    year: cs?.card?.year ? String(cs.card.year) : (ocr?.releaseYear || null),
    parallel: cs?.parallel?.name || null,
    rookie: ocr?.rookie || null,
    manufacturer: cs?.card?.manufacturer || ocr?.brand || null,
    gradingCompany: ocr?.gradingService && ocr.gradingService !== 'None' ? ocr.gradingService : null,
    grade: ocr?.gradeScore || null,
    certNumber: ocr?.certificationNumber || null,
    variants: variants ?? [],
    catalogueVerified: ocr?.catalogueMatch?.verified ?? null,
    cardsightCardId: cs?.card?.id ?? null,
    cardsightConfidence: cs?.confidence ?? null,
    cardsightAmbiguous: typeof cs?.ambiguous === 'boolean' ? cs.ambiguous : null,
  };
}
