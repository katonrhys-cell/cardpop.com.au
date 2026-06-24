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

// Load an image source (data URL, object URL, or Blob) into an HTMLImageElement.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Paint the professional "studio" backdrop: a near-black canvas with a soft
// radial spotlight behind where the card sits, plus a vignette. This is what
// gives formatted photos the premium dark-gradient look.
function drawStudioBackground(ctx, W, H) {
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, W, H);

  // Spotlight, centred slightly above the middle so the card is well lit.
  const glow = ctx.createRadialGradient(
    W / 2, H * 0.42, Math.min(W, H) * 0.04,
    W / 2, H * 0.5, Math.max(W, H) * 0.78
  );
  glow.addColorStop(0, '#3c3c45');
  glow.addColorStop(0.45, '#202027');
  glow.addColorStop(1, '#0a0a0d');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Vignette to darken the corners.
  const vignette = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.3,
    W / 2, H / 2, Math.max(W, H) * 0.72
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

// Crop a canvas down to its non-transparent bounding box so a cut-out card
// fills the frame without large empty margins. Returns the original canvas if
// it has no usable alpha (e.g. a fully opaque rectangle).
function trimToAlpha(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let data;
  try { data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; }
  catch { return canvas; }

  const { width: w, height: h } = canvas;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX) < w * 0.05 || (maxY - minY) < h * 0.05) return canvas;

  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = tw; out.height = th;
  out.getContext('2d').drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
  return out;
}

// Wrap an opaque (rectangular) card image in a canvas with rounded corners so
// the fallback path still drops a card-shaped silhouette (with shadow) onto the
// backdrop rather than a hard rectangle.
function roundedCardCanvas(source, sw, sh) {
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  const ctx = out.getContext('2d');
  const r = Math.max(6, Math.round(Math.min(sw, sh) * 0.035));
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(sw, 0, sw, sh, r);
  ctx.arcTo(sw, sh, 0, sh, r);
  ctx.arcTo(0, sh, 0, 0, r);
  ctx.arcTo(0, 0, sw, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(source, 0, 0, sw, sh);
  return out;
}

export function usePhotoTemplate() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [originalImageFile, setOriginalImageFile] = useState(null);

  const createSlabImagePreview = useCallback(async (imageFile) => {
    try {
      setIsProcessing(true);
      setOriginalImageFile(imageFile);

      // Build the foreground: ideally a clean, transparent cut-out of the card
      // via the ML background remover; if that's unavailable or fails, fall back
      // to colour-based card detection so the feature still works offline.
      let foreground = null; // a canvas containing the card with transparency
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        const cutoutBlob = await removeBackground(imageFile);
        const cutoutUrl = URL.createObjectURL(cutoutBlob);
        try {
          const cutImg = await loadImage(cutoutUrl);
          const c = document.createElement('canvas');
          c.width = cutImg.naturalWidth; c.height = cutImg.naturalHeight;
          c.getContext('2d').drawImage(cutImg, 0, 0);
          foreground = trimToAlpha(c);
        } finally {
          URL.revokeObjectURL(cutoutUrl);
        }
      } catch (err) {
        console.warn('[PhotoTemplate] ML cut-out unavailable, using fallback', err);
      }

      if (!foreground) {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target.result);
          r.onerror = reject;
          r.readAsDataURL(imageFile);
        });
        const img = await loadImage(dataUrl);
        const region = detectCardRegion(img);
        const sx = region ? region.sx : 0;
        const sy = region ? region.sy : 0;
        const sw = region ? region.sw : img.width;
        const sh = region ? region.sh : img.height;
        const crop = document.createElement('canvas');
        crop.width = sw; crop.height = sh;
        crop.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        foreground = roundedCardCanvas(crop, sw, sh);
      }

      // Compose the card, centred on the studio backdrop, leaving margin so the
      // spotlight reads around it. A soft drop shadow lifts it off the canvas.
      const canvas = document.createElement('canvas');
      canvas.width = TEMPLATE_W;
      canvas.height = TEMPLATE_H;
      const ctx = canvas.getContext('2d');
      drawStudioBackground(ctx, TEMPLATE_W, TEMPLATE_H);

      const maxW = TEMPLATE_W * 0.84;
      const maxH = TEMPLATE_H * 0.88;
      let dw = maxW;
      let dh = (maxW / foreground.width) * foreground.height;
      if (dh > maxH) { dh = maxH; dw = (maxH / foreground.height) * foreground.width; }
      const dx = Math.round((TEMPLATE_W - dw) / 2);
      const dy = Math.round((TEMPLATE_H - dh) / 2);

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 48;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 26;
      ctx.drawImage(foreground, dx, dy, dw, dh);
      ctx.restore();

      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
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
