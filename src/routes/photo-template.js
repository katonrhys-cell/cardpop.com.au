import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { createSlabImage, compressImage } from '../utils/imageProcessor.js';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Use the shared hardened upload middleware: 10MB cap + Content-Type gate +
// magic-byte validation (rejects files whose actual bytes aren't a real image),
// consistent with card-ocr/integrated-ai. Single-file field 'image'.
const uploadImage = uploadFiles({
  fieldName: 'image',
  maxCount: 1,
  maxSizeMB: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

// POST /photo-template/slab-image — create slab template image
router.post('/slab-image', authMiddleware, uploadImage, async (req, res) => {
  try {
    const file = req.files?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const { vaultItemId } = req.body;
    if (!vaultItemId) {
      return res.status(400).json({ error: 'vaultItemId is required' });
    }

    // Verify user owns the vault item
    const { data: vaultItem, error: fetchError } = await supabase
      .from('vault_items')
      .select('id, owner_id, card_image')
      .eq('id', vaultItemId)
      .single();

    if (fetchError || !vaultItem) {
      return res.status(404).json({ error: 'Vault item not found' });
    }

    if (vaultItem.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create slab template
    const slabImageBuffer = await createSlabImage(file.buffer);

    // Compress before upload
    const compressedBuffer = await compressImage(slabImageBuffer, 85);

    // Upload to Supabase Storage
    const fileName = `template-${vaultItemId}-${Date.now()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from('vault-images')
      .upload(fileName, compressedBuffer, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '31536000'
      });

    if (uploadError) {
      logger.error('[PHOTO-TEMPLATE] Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('vault-images')
      .getPublicUrl(fileName);

    // Update vault item with new image
    const { error: updateError } = await supabase
      .from('vault_items')
      .update({
        card_image: fileName,
        updated_at: new Date().toISOString()
      })
      .eq('id', vaultItemId)
      .eq('owner_id', req.user.id);

    if (updateError) {
      logger.error('[PHOTO-TEMPLATE] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update vault item' });
    }

    logger.info(`[PHOTO-TEMPLATE] Slab image created for vault item ${vaultItemId}`);

    res.json({
      success: true,
      imageUrl: publicUrl,
      fileName
    });
  } catch (error) {
    logger.error('[PHOTO-TEMPLATE] Error creating slab image:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// POST /photo-template/validate-image — validate image for browser processing
router.post('/validate-image', authMiddleware, uploadImage, async (req, res) => {
  try {
    const file = req.files?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Magic-byte validation already ran in uploadImage; echo back the verified type
    res.json({
      success: true,
      size: file.size,
      mimetype: file.mimetype
    });
  } catch (error) {
    logger.error('[PHOTO-TEMPLATE] Validation error:', error);
    res.status(500).json({ error: 'Failed to validate image' });
  }
});

export default router;
