import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { integratedAiClient } from '@/lib/integratedAiClient';
import { useIsMounted } from '@/hooks/useIsMounted.js';
import { groundAgainstCatalogue } from '@/utils/catalogueGrounding.js';
import { mapOCRResult, catalogueCollectionParam } from '@/utils/ocrResult.js';
import { ANALYSIS_IMAGE_LIMIT } from '@/utils/listingFlow.js';

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
      .slice(0, ANALYSIS_IMAGE_LIMIT);
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
      // (Pokemon / Magic / Yu-Gi-Oh) to correct the set, year and rarity.
      const resolved = await groundAgainstCatalogue(
        result,
        params => integratedAiClient.fetch(`/catalog/search?${new URLSearchParams(params)}`),
        catalogueCollectionParam(result.collectionType),
      );

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
