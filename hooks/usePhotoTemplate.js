import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiServerClient } from '@/lib/apiServerClient.js';

const TEMPLATE_W = 1000;
const TEMPLATE_H = 1400;

// Estimate the background colour from the image corners and find the card's
// bounding box via edge/contour (colour-difference) detection. Returns
// { sx, sy, sw, sh, bg } in source-image pixels, or null when detection isn't
// confident enough — in which case the caller falls back to the whole image.
function detectCardRegion(img) {
  const scale = Math.min(1, 700 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  let data;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return null; }

  // Background estimate = average of four corner patches.
  const p = Math.max(3, Math.floor(Math.min(w, h) * 0.05));
  const corners = [[0, 0], [w - p, 0], [0, h - p], [w - p, h - p]];
  let br = 0, bgc = 0, bb = 0, bn = 0;
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + p; y++) {
      for (let x = cx; x < cx + p; x++) {
        const i = (y * w + x) * 4;
        br += data[i]; bgc += data[i + 1]; bb += data[i + 2]; bn++;
      }
    }
  }
  br /= bn; bgc /= bn; bb /= bn;

  // Foreground = pixels differing from the background beyond a threshold.
  const TH = 50, TH2 = TH * TH;
  const colCount = new Int32Array(w);
  const rowCount = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = data[i] - br, dg = data[i + 1] - bgc, db = data[i + 2] - bb;
      if (dr * dr + dg * dg + db * db > TH2) { colCount[x]++; rowCount[y]++; }
    }
  }

  // A column/row belongs to the card when enough of its pixels are foreground.
  const colMin = Math.max(3, Math.floor(h * 0.12));
  const rowMin = Math.max(3, Math.floor(w * 0.12));
  let minX = -1, maxX = -1, minY = -1, maxY = -1;
  for (let x = 0; x < w; x++) if (colCount[x] >= colMin) { if (minX < 0) minX = x; maxX = x; }
  for (let y = 0; y < h; y++) if (rowCount[y] >= rowMin) { if (minY < 0) minY = y; maxY = y; }

  if (minX < 0 || minY < 0) return null;
  const bw = maxX - minX, bh = maxY - minY;
  // Reject low-confidence results: too small to be the card, or essentially the
  // whole frame (meaning nothing distinct was detected).
  if (bw < w * 0.15 || bh < h * 0.15) return null;
  if (bw > w * 0.97 && bh > h * 0.97) return null;

  // Map back to source pixels with a little padding.
  const pad = 0.015;
  const sx = Math.max(0, Math.round((minX / w - pad) * img.width));
  const sy = Math.max(0, Math.round((minY / h - pad) * img.height));
  const ex = Math.min(1, maxX / w + pad) * img.width;
  const ey = Math.min(1, maxY / h + pad) * img.height;
  return {
    sx, sy,
    sw: Math.max(1, Math.round(ex - sx)),
    sh: Math.max(1, Math.round(ey - sy)),
    bg: [br, bgc, bb],
  };
}

export function usePhotoTemplate() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalImageFile, setOriginalImageFile] = useState(null);

  const createSlabImagePreview = useCallback(async (imageFile) => {
    try {
      setIsProcessing(true);
      setOriginalImageFile(imageFile);

      // Read the image file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = new Image();

          img.onload = () => {
            // The card should fill 95% of the template in both dimensions.
            const cardMaxWidth = Math.round(TEMPLATE_W * 0.95);
            const cardMaxHeight = Math.round(TEMPLATE_H * 0.95);

            // Detect the card and crop to it; fall back to the whole image.
            let sx = 0, sy = 0, sw = img.width, sh = img.height, bgColor = null;
            const region = detectCardRegion(img);
            if (region) {
              sx = region.sx; sy = region.sy; sw = region.sw; sh = region.sh;
              bgColor = region.bg;
            }

            // Draw the cropped card onto its own canvas.
            const crop = document.createElement('canvas');
            crop.width = sw; crop.height = sh;
            const cctx = crop.getContext('2d', { willReadFrequently: true });
            cctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

            // Remove background: whiten pixels close to the estimated bg colour.
            if (bgColor) {
              try {
                const cd = cctx.getImageData(0, 0, sw, sh);
                const a = cd.data;
                const WT = 42, WT2 = WT * WT;
                for (let i = 0; i < a.length; i += 4) {
                  const dr = a[i] - bgColor[0], dg = a[i + 1] - bgColor[1], db = a[i + 2] - bgColor[2];
                  if (dr * dr + dg * dg + db * db < WT2) { a[i] = 255; a[i + 1] = 255; a[i + 2] = 255; }
                }
                cctx.putImageData(cd, 0, 0);
              } catch { /* tainted canvas — skip whitening */ }
            }

            // Scale the cropped card to fit the template, centered.
            let cardWidth = cardMaxWidth;
            let cardHeight = (cardMaxWidth / sw) * sh;
            if (cardHeight > cardMaxHeight) {
              cardHeight = cardMaxHeight;
              cardWidth = (cardMaxHeight / sh) * sw;
            }
            const cardX = Math.round((TEMPLATE_W - cardWidth) / 2);
            const cardY = Math.round((TEMPLATE_H - cardHeight) / 2);

            const canvas = document.createElement('canvas');
            canvas.width = TEMPLATE_W;
            canvas.height = TEMPLATE_H;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, TEMPLATE_W, TEMPLATE_H);
            ctx.drawImage(crop, cardX, cardY, cardWidth, cardHeight);

            setPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
          };

          img.src = e.target.result;
        } catch (error) {
          console.error('Error creating preview:', error);
          toast.error('Failed to create preview');
        }
      };

      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const removeBackgroundPreview = useCallback(async (imageFile) => {
    try {
      setIsProcessing(true);
      setOriginalImageFile(imageFile);

      // Load rembg ONNX model for browser-based background removal
      const { removeBackground } = await import('@imgly/background-removal');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await removeBackground(e.target.result);

          // Convert blob to data URL
          const url = URL.createObjectURL(result);
          setPreviewUrl(url);
        } catch (error) {
          console.error('Background removal error:', error);
          toast.error('Failed to remove background. Make sure your image is clear and well-lit.');
        }
      };

      reader.readAsArrayBuffer(imageFile);
    } catch (error) {
      console.error('Error loading background removal:', error);
      toast.error('Background removal is not available. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const uploadProcessedImage = useCallback(async (vaultItemId, processType) => {
    try {
      if (!originalImageFile || !previewUrl) {
        throw new Error('No image to upload');
      }

      setIsProcessing(true);

      const formData = new FormData();
      formData.append('image', originalImageFile);
      formData.append('vaultItemId', vaultItemId);

      const endpoint = '/photo-template/slab-image';

      const response = await apiServerClient.fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      toast.success('Photo formatted successfully!');

      // Clear state
      setPreviewUrl(null);
      setOriginalImageFile(null);

      return result;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [originalImageFile, previewUrl]);

  const reset = useCallback(() => {
    setPreviewUrl(null);
    setOriginalImageFile(null);
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    previewUrl,
    createSlabImagePreview,
    removeBackgroundPreview,
    uploadProcessedImage,
    reset
  };
}
