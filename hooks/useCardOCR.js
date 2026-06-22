import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { integratedAiClient } from '@/lib/integratedAiClient';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import { useIsMounted } from '@/hooks/useIsMounted.js';

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

// Compare the leading numeric portion of two collector numbers, ignoring the
// "/total" suffix and leading zeros (e.g. "004/102" matches "4").
function cardNumbersMatch(a, b) {
  const lead = v => String(v ?? '').split('/')[0].replace(/[^a-z0-9]/gi, '').replace(/^0+/, '').toLowerCase();
  const na = lead(a);
  const nb = lead(b);
  return !!na && na === nb;
}

// Scores a catalogue candidate against the OCR result. Name match dominates;
// a matching card number or year adds confidence.
function scoreCandidate(ocr, candidate) {
  const target = normalizeName(ocr.name);
  const name = normalizeName(candidate.name);
  let score = 0;

  if (name && name === target) score += 3;
  else if (name && (name.includes(target) || target.includes(name))) score += 2;
  else {
    const targetTokens = new Set(target.split(' ').filter(Boolean));
    const overlap = name.split(' ').filter(w => targetTokens.has(w)).length;
    score += Math.min(overlap, 2) * 0.5;
  }

  if (ocr.cardNumber && cardNumbersMatch(ocr.cardNumber, candidate.cardNumber)) score += 2;
  if (ocr.releaseYear && candidate.year && String(candidate.year) === String(ocr.releaseYear)) score += 1;

  return score;
}

// Resolves the OCR guess against the public card catalogue and, when a
// confident match is found, overlays the authoritative set/number/year/rarity.
// Always returns a result object — never throws — so a catalogue outage can
// never break the scan.
async function resolveAgainstCatalogue(result) {
  const name = result.name?.trim();
  if (!name) return result;

  try {
    const params = new URLSearchParams({ q: name, take: '8' });
    const collection = catalogueCollectionParam(result.collectionType);
    if (collection) params.set('collection', collection);

    const data = await integratedAiClient.fetch(`/catalog/search?${params.toString()}`);
    const candidates = data?.results ?? [];
    if (!candidates.length) return result;

    const ranked = candidates
      .map(c => ({ candidate: c, score: scoreCandidate(result, c) }))
      .sort((a, b) => b.score - a.score);

    const top3 = ranked.slice(0, 3).map(r => r.candidate);
    const best = ranked[0];

    // Below this threshold we surface candidates but don't override OCR fields.
    if (!best || best.score < 2) {
      return { ...result, catalogueCandidates: top3 };
    }

    const m = best.candidate;
    return {
      ...result,
      cardSetName: m.setName || result.cardSetName,
      cardNumber: m.cardNumber || result.cardNumber,
      releaseYear: m.year ? String(m.year) : result.releaseYear,
      rarity: result.rarity || mapRarity(m.rarity),
      series: m.setName || result.series,
      catalogueMatch: {
        id: m.id,
        name: m.name,
        setName: m.setName ?? null,
        cardNumber: m.cardNumber ?? null,
        year: m.year ?? null,
        rarity: m.rarity ?? null,
        imageUrl: m.imageUrl ?? null,
        source: m.source ?? null,
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
