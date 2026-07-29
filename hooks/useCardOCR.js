import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { integratedAiClient } from '@/lib/integratedAiClient';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import { useIsMounted } from '@/hooks/useIsMounted.js';
import { leadingCardNumber, cardNumbersMatch, cardNumbersConflict } from '@/utils/cardNumber.js';

const SSEEventType = {
  Content: 'content',
  Error: 'error',
  Completed: 'completed',
};

export function useCardOCR() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const isMounted = useIsMounted();

  const scanCard = useCallback(async (imageInput) => {
    // Accept a single File or an array of Files (front + back/extra angles).
    const imageFiles = (Array.isArray(imageInput) ? imageInput : [imageInput])
      .filter(Boolean)
      .slice(0, 3);
    if (!imageFiles.length) return;

    setIsScanning(true);
    setScanResult(null);

    try {
      const response = await integratedAiClient.stream('/card-ocr/scan', {
        body: { message: [{ text: 'Analyze this card.', type: 'text' }] },
        images: imageFiles,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let completed = false;

      try {
        while (!completed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            const lines = event.split('\n');
            let eventData = '';
            for (const line of lines) {
              if (line.startsWith('data: ')) eventData += line.slice(6);
            }
            if (!eventData) continue;

            let parsed;
            try {
              parsed = JSON.parse(eventData);
            } catch {
              throw new Error('Received malformed data from scan service');
            }

            if (parsed.type === SSEEventType.Error) throw new Error(parsed.data.content);
            if (parsed.type === SSEEventType.Completed) { completed = true; break; }
            if (parsed.type === SSEEventType.Content) fullContent += parsed.data.content;
          }
        }
      } finally {
        reader.cancel();
      }

      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not extract card data from image');

      const data = JSON.parse(jsonMatch[0]);
      const result = mapOCRResult(data);

      // Ground the free-text OCR guess against a real card catalogue
      // (Pokemon / Magic / Yu-Gi-Oh) to correct the set, number and rarity.
      const resolved = await resolveAgainstCatalogue(result);

      if (isMounted()) setScanResult(resolved);
      toast.success(resolved.catalogueMatch
        ? `Matched to catalogue: ${resolved.cardSetName || resolved.name}. Review before applying.`
        : 'Card scanned — review the extracted details before applying.');
      return resolved;
    } catch (err) {
      // Surface the failure to the user instead of silently swallowing it —
      // otherwise the scan animation just vanishes with no feedback.
      console.warn('[useCardOCR] scan failed:', err.message);
      toast.error(err.message || 'Card scan failed. Please try again.');
    } finally {
      if (isMounted()) setIsScanning(false);
    }
  }, [isMounted]);

  return {
    scanCard,
    isScanning,
    scanResult,
    clearScan: () => setScanResult(null),
  };
}

function mapOCRResult(data) {
  const condition = mapCondition(data.condition);
  const gradingService = mapGradingService(data.gradingService);
  const rarity = mapRarity(data.rarity);
  const collectionType = mapCollectionType(data.collectionType);

  return {
    name: data.name || '',
    description: data.description || '',
    cardSetName: data.cardSetName || '',
    cardNumber: data.cardNumber || '',
    releaseYear: data.releaseYear ? String(data.releaseYear) : '',
    collectionType,
    condition,
    gradingService,
    gradeScore: data.gradeScore != null ? String(data.gradeScore) : '',
    certificationNumber: data.certificationNumber || '',
    rarity,
    cardType: data.cardType || '',
    brand: data.brand || '',
    series: data.series || data.cardSetName || '',
    confidence: data.confidence || null,
    candidateSets: Array.isArray(data.candidateSets) ? data.candidateSets : [],
  };
}

// Maps the OCR collectionType to the /catalog/search collection param. The
// catalogue route only covers Pokemon, Magic and Yu-Gi-Oh; for anything else
// we send no collection and let the backend try all three.
function catalogueCollectionParam(collectionType) {
  const c = (collectionType || '').toLowerCase();
  if (c.includes('pokemon') || c.includes('pokémon')) return 'pokemon';
  if (c.includes('magic')) return 'magic';
  if (c.includes('yu-gi-oh') || c.includes('yugioh')) return 'yu-gi-oh';
  return '';
}

function normalizeName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 'exact' | 'partial' | 'none' — how well a candidate's name matches the read. */
function nameSignal(ocr, candidate) {
  const target = normalizeName(ocr.name);
  const name = normalizeName(candidate.name);
  if (!target || !name) return 'none';
  if (name === target) return 'exact';
  if (name.includes(target) || target.includes(name)) return 'partial';
  return 'none';
}

// Words that describe a set without distinguishing it from another, so a name
// differing only by these is the same set read two ways ("Base" / "Base Set").
const SET_NOISE_WORDS = new Set(['the', 'set', 'series', 'edition', 'expansion', 'collection', 'tcg']);

/**
 * Whether two set names refer to the same set.
 *
 * Plain substring containment is not good enough here: set names nest, so
 * "Base Set" contains-matches "Base Set 2" and "Sword & Shield" matches
 * "Sword & Shield Promo" — different sets that would then corroborate each
 * other. Containment counts only when the extra words carry no distinguishing
 * information; a trailing "2" or "Promo" does.
 */
function setsMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  const shortWords = shorter.split(' ').filter(Boolean);
  const longWords = longer.split(' ').filter(Boolean);
  if (!shortWords.every(w => longWords.includes(w))) return false;

  const shortSet = new Set(shortWords);
  return longWords.filter(w => !shortSet.has(w)).every(w => SET_NOISE_WORDS.has(w));
}

/**
 * How well a candidate's set agrees with the read: 'set' when it matches the
 * one OCR settled on, 'likely set' when it matches one the model shortlisted
 * instead, null otherwise.
 *
 * The prompt asks the model to shortlist up to three sets rather than name one
 * with false confidence. That shortlist used to be parsed and thrown away —
 * but a card whose set the model wouldn't commit to is exactly the case where
 * corroboration is scarcest, and the catalogue independently landing on one of
 * its three guesses is real agreement. It ranks below an outright set match and
 * is reported under its own label so the UI never overstates it.
 */
function setSignal(ocr, candidate) {
  if (setsMatch(ocr.cardSetName, candidate.setName)) return 'set';
  const shortlist = Array.isArray(ocr.candidateSets) ? ocr.candidateSets : [];
  if (shortlist.some(s => setsMatch(s, candidate.setName))) return 'likely set';
  return null;
}

/**
 * Compares one catalogue candidate against what OCR read off the card, and
 * reports which fields independently agree.
 *
 * `numberConflicts` is tracked separately from "doesn't match": a candidate
 * with no number on record is merely unknown, but one whose number positively
 * disagrees is a different printing and must never be merged in.
 */
function evaluateCandidate(ocr, candidate) {
  const name = nameSignal(ocr, candidate);
  const numberMatches = cardNumbersMatch(ocr.cardNumber, candidate.cardNumber);
  const numberConflicts = cardNumbersConflict(ocr.cardNumber, candidate.cardNumber);
  const setMatch = setSignal(ocr, candidate);
  const yearMatches = Boolean(
    ocr.releaseYear && candidate.year && String(candidate.year) === String(ocr.releaseYear)
  );

  const verified = [];
  if (name !== 'none') verified.push('name');
  if (numberMatches) verified.push('number');
  if (setMatch) verified.push(setMatch);
  if (yearMatches) verified.push('year');

  return { name, numberMatches, numberConflicts, setMatch, yearMatches, verified };
}

/**
 * Whether a candidate is trustworthy enough to overwrite what OCR read.
 *
 * The bar is deliberately high. A name match alone used to be enough, which
 * meant that for any card with more than one printing — Pikachu, Charizard,
 * Black Lotus — an arbitrary candidate from the name search replaced the set,
 * number and year that had been read correctly off the card. Grounding made
 * the answer worse than no grounding at all.
 *
 * So: the printed collector number settles it when both sides have one, and
 * without it we need two independent agreements before overwriting anything.
 */
function isAcceptableMatch(evaluation) {
  if (evaluation.numberConflicts) return false;  // different printing
  if (evaluation.name === 'none') return false;  // never match on non-name evidence alone
  if (evaluation.numberMatches) return true;     // name + printed number agree
  return Boolean(evaluation.setMatch) || evaluation.yearMatches;
}

/** Ranks acceptable candidates: corroborated fields first, then name quality. */
function matchStrength(evaluation) {
  return (evaluation.numberMatches ? 4 : 0)
    + (evaluation.setMatch === 'set' ? 2 : evaluation.setMatch === 'likely set' ? 1 : 0)
    + (evaluation.yearMatches ? 1 : 0)
    + (evaluation.name === 'exact' ? 2 : evaluation.name === 'partial' ? 1 : 0);
}

// Resolves the OCR guess against the public card catalogue and, when a
// confident match is found, overlays the authoritative set/number/year/rarity.
// Always returns a result object — never throws — so a catalogue outage can
// never break the scan.
async function resolveAgainstCatalogue(result) {
  const name = result.name?.trim();
  if (!name) return result;

  try {
    // Send the collector number so the catalogue can filter on it upstream
    // instead of us picking through an arbitrary page of same-name printings.
    // Without one, ask for more rows — that's the harder case, not the easier.
    const cardNumber = leadingCardNumber(result.cardNumber);
    const params = new URLSearchParams({ q: name, take: cardNumber ? '8' : '12' });
    if (cardNumber) params.set('number', cardNumber);
    const collection = catalogueCollectionParam(result.collectionType);
    if (collection) params.set('collection', collection);

    const data = await integratedAiClient.fetch(`/catalog/search?${params.toString()}`);
    const candidates = data?.results ?? [];
    if (!candidates.length) return result;

    const ranked = candidates
      .map(candidate => ({ candidate, evaluation: evaluateCandidate(result, candidate) }))
      .sort((a, b) => matchStrength(b.evaluation) - matchStrength(a.evaluation));

    const top3 = ranked.slice(0, 3).map(r => r.candidate);
    const best = ranked.find(r => isAcceptableMatch(r.evaluation));

    // Nothing corroborated well enough — surface the candidates for the seller
    // to look at, but leave every field exactly as it was read off the card.
    if (!best) {
      return { ...result, catalogueCandidates: top3 };
    }

    const m = best.candidate;
    return {
      ...result,
      // The catalogue is authoritative for the set, year and rarity — those are
      // often absent or ambiguous on the card itself.
      cardSetName: m.setName || result.cardSetName,
      releaseYear: m.year ? String(m.year) : result.releaseYear,
      rarity: result.rarity || mapRarity(m.rarity),
      series: m.setName || result.series,
      // The collector number is printed on the card and was read directly, so
      // it stands. The catalogue only supplies one when OCR couldn't read it.
      cardNumber: result.cardNumber || m.cardNumber || '',
      catalogueMatch: {
        id: m.id,
        name: m.name,
        setName: m.setName ?? null,
        cardNumber: m.cardNumber ?? null,
        year: m.year ?? null,
        rarity: m.rarity ?? null,
        imageUrl: m.imageUrl ?? null,
        source: m.source ?? null,
        // Exactly which fields agreed, so the UI can say what was checked
        // rather than claiming a blanket verification.
        verified: best.evaluation.verified,
      },
      catalogueCandidates: top3,
    };
  } catch {
    // Catalogue lookup is best-effort — fall back to the raw OCR result.
    return result;
  }
}

function mapCondition(raw) {
  const c = (raw || '').toLowerCase();
  if (c.includes('near mint') || c === 'nm') return 'Near Mint';
  if (c.includes('mint')) return 'Mint';
  if (c.includes('excellent') || c.includes('lightly played')) return 'Excellent';
  if (c.includes('good') || c.includes('moderately played')) return 'Good';
  if (c.includes('fair') || c.includes('heavily played') || c.includes('poor')) return 'Fair';
  return 'Good';
}

function mapGradingService(raw) {
  const gs = (raw || '').toUpperCase();
  if (gs.includes('PSA')) return 'PSA';
  if (gs.includes('BGS') || gs.includes('BECKETT')) return 'BGS';
  if (gs.includes('CGC')) return 'CGC';
  if (gs.includes('SGC')) return 'SGC';
  if (gs.includes('ACE')) return 'ACE';
  return 'None';
}

function mapRarity(raw) {
  const r = (raw || '').toLowerCase();
  if (r.includes('secret') || r.includes('ultra rare')) return 'Secret Rare';
  if (r.includes('holo') || r.includes('holographic')) return 'Holographic';
  if (r.includes('rare')) return 'Rare';
  if (r.includes('uncommon')) return 'Uncommon';
  if (r.includes('common')) return 'Common';
  return null;
}

function mapCollectionType(raw) {
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const match = COLLECTIONS_LIST.find(c => c.toLowerCase() === lower || lower.includes(c.toLowerCase()));
  return match || '';
}
