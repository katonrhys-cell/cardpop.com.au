import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { detectAndCropCard } from '@/utils/detectCard.js';

/**
 * Manages opt-in card auto-cropping for one or more image slots.
 *
 * A `key` identifies which slot a crop belongs to (e.g. 'main' or an extra-photo
 * index) so a single hook instance can drive the main image and every extra
 * slot — only one crop flow is active at a time.
 *
 *   detect(key, file) — lazy-loads OpenCV, detects + deskews the card, and on
 *                       success stores a candidate; returns true if one was found.
 *   candidate         — { key, croppedFile, croppedUrl } | null
 *   detectingKey      — the key currently being processed, or null
 *   clear()           — discard the current candidate
 */
export function useCardCrop() {
  const [detectingKey, setDetectingKey] = useState(null);
  const [candidate, setCandidate] = useState(null);

  const detect = useCallback(async (key, file) => {
    if (!file) return false;
    setCandidate(null);
    setDetectingKey(key);
    try {
      const res = await detectAndCropCard(file);
      if (res?.found && res.blob) {
        const base = (file.name || 'card').replace(/\.[^.]+$/, '');
        const croppedFile = new File([res.blob], `${base}-cropped.jpg`, { type: 'image/jpeg' });
        setCandidate({ key, croppedFile, croppedUrl: res.url });
        return true;
      }
      toast.info('No card outline detected — keeping the original.');
      return false;
    } catch {
      toast.error('Could not process the image. Keeping the original.');
      return false;
    } finally {
      setDetectingKey(null);
    }
  }, []);

  const clear = useCallback(() => setCandidate(null), []);

  return { detectingKey, candidate, detect, clear };
}
