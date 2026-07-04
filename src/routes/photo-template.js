import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { createSlabImage, compressImage } from '../utils/imageProcessor.js';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Multer for file upload
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  storage: multer.memoryStorage()
});

// POST /photo-template/slab-image — create slab template image
router.post('/slab-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
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
    const slabImageBuffer = await createSlabImage(req.file.buffer);

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
router.post('/validate-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Simply return success if file exists and is valid
    res.json({
      success: true,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    logger.error('[PHOTO-TEMPLATE] Validation error:', error);
    res.status(500).json({ error: 'Failed to validate image' });
  }
});

export default router;
