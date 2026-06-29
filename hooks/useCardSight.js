import { useState, useCallback } from 'react';
import { apiServerClient } from '@/lib/apiServerClient';
import { useIsMounted } from '@/hooks/useIsMounted.js';

/**
 * Sends a card image to CardSight AI and returns identification,
 * catalog data, and real-market pricing in one call.
 *
 * Returns:
 *   identify(imageFile)    — run identification
 *   isIdentifying          — loading state
 *   result                 — full response ({ identified, card, catalog, pricing, grading, parallel })
 *   clearResult()          — reset state
 */
export function useCardSight() {
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [result, setResult] = useState(null);
  const isMounted = useIsMounted();

  const identify = useCallback(async (imageFile, collection) => {
    if (!imageFile) return;

    setIsIdentifying(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (collection) formData.append('collection', collection);

      const response = await apiServerClient.fetch('/cardsight/identify', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // Return structured error so caller can show a meaningful message
        const errMsg = err.error || err.message || `CardSight identify failed (${response.status})`;
        return { identified: false, apiError: true, message: errMsg };
      }

      const data = await response.json();
      if (isMounted()) setResult(data);
      return data;
    } catch (err) {
      console.warn('[useCardSight] identify failed:', err.message);
      return { identified: false, apiError: true, message: err.message };
    } finally {
      if (isMounted()) setIsIdentifying(false);
    }
  }, [isMounted]);

  /**
   * Fetch pricing for a known CardSight card ID (e.g. after editing a card
   * whose cardsight_card_id was stored at upload time).
   */
  const fetchPricing = useCallback(async (cardId, opts = {}) => {
    if (!cardId) return null;
    try {
      const params = new URLSearchParams(Object.entries(opts).filter(([, v]) => v != null));
      const response = await apiServerClient.fetch(`/cardsight/pricing/${cardId}?${params}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  /**
   * Search the CardSight catalog (cards, sets, releases).
   */
  const searchCatalog = useCallback(async (q, opts = {}) => {
    if (!q?.trim()) return null;
    try {
      const params = new URLSearchParams({ q: q.trim(), ...opts });
      const response = await apiServerClient.fetch(`/catalog/search?${params}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  return {
    identify,
    fetchPricing,
    searchCatalog,
    isIdentifying,
    result,
    clearResult: () => setResult(null),
  };
}

/**
 * Maps a CardSight identification result to the vault form field shape
 * used by AddEditCardPage.
 */
export function mapCardSightToFormFields(result) {
  if (!result?.identified) return {};

  const { card, grading, parallel } = result;
  const fields = {};

  if (card?.name)         fields.cardName        = card.name;
  if (card?.setName)      fields.setName         = card.setName;
  if (card?.cardNumber)   fields.cardNumber      = card.cardNumber;
  if (card?.year)         fields.year            = String(card.year);
  if (card?.rarity)       fields.variant         = card.rarity;  // closest match
  if (card?.manufacturer) fields.manufacturerName = card.manufacturer;

  // Grading slab detection
  if (grading) {
    const company = (grading.company || '').toLowerCase();
    if (company.includes('psa'))     fields.gradingCompany = 'psa';
    else if (company.includes('bgs') || company.includes('beckett')) fields.gradingCompany = 'bgs';
    else if (company.includes('cgc')) fields.gradingCompany = 'cgc';
    else if (company.includes('sgc')) fields.gradingCompany = 'sgc';
    if (grading.grade)  fields.grade      = String(grading.grade);
  }

  // Collection/sport mapping
  if (card?.segment || card?.sport) {
    const seg = (card.segment || card.sport || '').toLowerCase();
    if (seg.includes('pokemon') || seg.includes('tcg')) fields.collection = 'Pokemon';
    else if (seg.includes('basketball') || seg.includes('nba')) fields.collection = 'NBA Basketball';
    else if (seg.includes('football') || seg.includes('nfl')) fields.collection = 'NFL Football';
    else if (seg.includes('baseball') || seg.includes('mlb')) fields.collection = 'MLB';
    else if (seg.includes('soccer') || seg.includes('football')) fields.collection = 'Soccer';
    else if (seg.includes('ufc') || seg.includes('mma')) fields.collection = 'UFC';
  }

  return fields;
}
