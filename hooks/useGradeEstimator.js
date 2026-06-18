import { useState, useCallback } from 'react';
import { integratedAiClient } from '@/lib/integratedAiClient';
import { useIsMounted } from '@/hooks/useIsMounted.js';

const SSEEventType = {
  Content: 'content',
  Error: 'error',
  Completed: 'completed',
};

export function useGradeEstimator() {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const isMounted = useIsMounted();

  const estimateGrade = useCallback(async (imageFiles) => {
    if (!imageFiles?.length) return;

    setIsAnalysing(true);
    setResult(null);
    setError(null);

    try {
      const response = await integratedAiClient.stream('/grade-estimator/estimate', {
        body: { message: [{ text: 'Analyse this card.', type: 'text' }] },
        images: Array.from(imageFiles),
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
              throw new Error('Received malformed data from analysis service');
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
      if (!jsonMatch) throw new Error('Could not extract grade data from analysis');

      const data = JSON.parse(jsonMatch[0]);
      if (isMounted()) setResult(data);
      return data;
    } catch (err) {
      const message = err.message || 'Grade estimation failed';
      if (isMounted()) setError(message);
    } finally {
      if (isMounted()) setIsAnalysing(false);
    }
  }, [isMounted]);

  return {
    estimateGrade,
    isAnalysing,
    result,
    error,
    reset: () => { setResult(null); setError(null); },
  };
}
