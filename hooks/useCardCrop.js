import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { detectAndCropCard } from '@/utils/detectCard.js';

/**
 * Manages card auto-cropping for one or more image slots.
 *
 * A `key` identifies which slot a crop belongs to (e.g. 'main' or an extra-photo
 * index) so a single hook instance can drive the main image and every extra
 * slot — only one crop flow is active at a time.
 *
 *   detect(key, file, opts) — lazy-loads OpenCV, detects + deskews the card, and
 *                       on success stores a candidate; returns true if one was
 *                       found. `opts.silent` suppresses the not-found/error
 *                       toasts — used by the automatic run on photo select,
 *                       where "nothing detected" is not news the seller asked
 *                       for. Explicit button taps stay loud.
 *   candidate         — { key, croppedFile, croppedUrl } | null
 *   detectingKey      — the key currently being processed, or null
 *   clear()           — discard the current candidate
 */
export function useCardCrop() {
  const [detectingKey, setDetectingKey] = useState(null);
  const [candidate, setCandidate] = useState(null);
  // Monotonic run id: a seller can re-pick a photo while an automatic detection
  // is still running, and the stale run's result must not clobber the new one.
  const runRef = useRef(0);

  const detect = useCallback(async (key, file, { silent = false } = {}) => {
    if (!file) return false;
    const run = ++runRef.current;
    setCandidate(null);
    setDetectingKey(key);
    try {
      const res = await detectAndCropCard(file);
      if (run !== runRef.current) return false; // superseded by a newer pick
      if (res?.found && res.blob) {
        const base = (file.name || 'card').replace(/\.[^.]+$/, '');
        const croppedFile = new File([res.blob], `${base}-cropped.jpg`, { type: 'image/jpeg' });
        // Keep the detected corners so the manual adjuster can be seeded with them.
        setCandidate({ key, croppedFile, croppedUrl: res.url, corners: res.corners ?? null });
        return true;
      }
      if (!silent) toast.info('No card outline detected — keeping the original.');
      return false;
    } catch {
      if (run === runRef.current && !silent) {
        toast.error('Could not process the image. Keeping the original.');
      }
      return false;
    } finally {
      if (run === runRef.current) setDetectingKey(null);
    }
  }, []);

  const clear = useCallback(() => setCandidate(null), []);

  return { detectingKey, candidate, detect, clear };
}
