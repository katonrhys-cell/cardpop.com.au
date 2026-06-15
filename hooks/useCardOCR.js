import { useState, useCallback } from 'react';
import { integratedAiClient } from '@/lib/integratedAiClient';
import { toast } from 'sonner';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';

const SSEEventType = {
  Content: 'content',
  Error: 'error',
  Completed: 'completed',
};

export function useCardOCR() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const scanCard = useCallback(async (imageFile) => {
    if (!imageFile) return;

    setIsScanning(true);
    setScanResult(null);

    try {
      const response = await integratedAiClient.stream('/card-ocr/scan', {
        body: { message: [{ text: 'Analyze this card.', type: 'text' }] },
        images: [imageFile],
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
      setScanResult(result);
      return result;
    } catch (err) {
      // Non-fatal — OCR is a fallback; log but don't alarm the user
      console.warn('[useCardOCR] scan failed:', err.message);
    } finally {
      setIsScanning(false);
    }
  }, []);

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
  };
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
