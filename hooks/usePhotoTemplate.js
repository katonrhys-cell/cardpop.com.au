import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiServerClient } from '@/lib/apiServerClient.js';

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
          const canvas = document.createElement('canvas');
          const img = new Image();

          img.onload = () => {
            // Template dimensions
            const templateWidth = 1000;
            const templateHeight = 1400;

            // Calculate scaling
            const originalWidth = img.width;
            const originalHeight = img.height;
            const cardMaxWidth = templateWidth - 160;
            const cardMaxHeight = templateHeight - 200;

            let cardWidth = cardMaxWidth;
            let cardHeight = (cardMaxWidth / originalWidth) * originalHeight;

            if (cardHeight > cardMaxHeight) {
              cardHeight = cardMaxHeight;
              cardWidth = (cardMaxHeight / originalHeight) * originalWidth;
            }

            const cardX = Math.round((templateWidth - cardWidth) / 2);
            const cardY = Math.round((templateHeight - cardHeight) / 2 - 50);

            // Create canvas
            canvas.width = templateWidth;
            canvas.height = templateHeight;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, templateWidth, templateHeight);

            // Draw card image
            ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);

            // Get preview URL
            const preview = canvas.toDataURL('image/jpeg', 0.9);
            setPreviewUrl(preview);
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
