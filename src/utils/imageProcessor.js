import logger from './logger.js';

// sharp is a native module that loads a platform-specific binary at import
// time. Importing it at module top level means any binary-load failure (e.g.
// the Vercel serverless bundle missing @img/sharp-linux-x64) throws while the
// app is initialising — which crashes the ENTIRE Express function, taking down
// every API route rather than just the image endpoints. Loading it lazily
// keeps such a failure contained to the routes that actually use sharp.
let _sharpPromise = null;
function getSharp() {
  if (!_sharpPromise) {
    _sharpPromise = import('sharp')
      .then(mod => mod.default ?? mod)
      .catch(err => {
        _sharpPromise = null; // let a later call retry
        throw err;
      });
  }
  return _sharpPromise;
}

export async function createSlabImage(imageBuffer) {
  try {
    const sharp = await getSharp();
    // Get original image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // Template dimensions
    const templateWidth = 1000;
    const templateHeight = 1400;

    // Calculate scaling so the card fills 95% of the template while
    // maintaining its aspect ratio.
    const cardMaxWidth = Math.round(templateWidth * 0.95);
    const cardMaxHeight = Math.round(templateHeight * 0.95);

    let cardWidth = cardMaxWidth;
    let cardHeight = (cardMaxWidth / originalWidth) * originalHeight;

    if (cardHeight > cardMaxHeight) {
      cardHeight = cardMaxHeight;
      cardWidth = (cardMaxHeight / originalHeight) * originalWidth;
    }

    // Center card in template
    const cardX = Math.round((templateWidth - cardWidth) / 2);
    const cardY = Math.round((templateHeight - cardHeight) / 2);

    // Resize and composite the card onto white background
    const resizedCard = await sharp(imageBuffer)
      .resize(Math.round(cardWidth), Math.round(cardHeight), {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toBuffer();

    // Create white canvas
    const composite = await sharp({
      create: {
        width: templateWidth,
        height: templateHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
      .composite([
        {
          input: resizedCard,
          left: cardX,
          top: cardY
        }
      ])
      .webp({ quality: 85 })
      .toBuffer();

    logger.info('[IMAGE] Created slab image successfully');
    return composite;
  } catch (error) {
    logger.error('[IMAGE] Error creating slab image:', error);
    throw error;
  }
}

export async function removeBackground(imageBuffer, method = 'browser') {
  try {
    if (method === 'server') {
      // Server-side background removal using rembg would go here
      // For now, we'll return the original and handle on frontend
      logger.info('[IMAGE] Background removal delegated to browser');
      return imageBuffer;
    }

    // For browser method, we just validate and return
    const sharp = await getSharp();
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image');
    }

    logger.info('[IMAGE] Image validated for browser-based processing');
    return imageBuffer;
  } catch (error) {
    logger.error('[IMAGE] Error validating image:', error);
    throw error;
  }
}

export async function compressImage(imageBuffer, quality = 80) {
  try {
    const sharp = await getSharp();
    const compressed = await sharp(imageBuffer)
      .webp({ quality })
      .toBuffer();

    logger.info('[IMAGE] Image compressed successfully');
    return compressed;
  } catch (error) {
    logger.error('[IMAGE] Error compressing image:', error);
    throw error;
  }
}
