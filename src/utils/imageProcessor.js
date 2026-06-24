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

// SVG for the professional "studio" backdrop: a near-black canvas with a soft
// radial spotlight and a vignette. Rasterised by sharp so the look matches the
// client-side formatter in hooks/usePhotoTemplate.js.
function studioBackdropSvg(width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="glow" cx="50%" cy="42%" r="78%">
          <stop offset="0%" stop-color="#3c3c45"/>
          <stop offset="45%" stop-color="#202027"/>
          <stop offset="100%" stop-color="#0a0a0d"/>
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="#0a0a0d"/>
      <rect width="100%" height="100%" fill="url(#glow)"/>
      <rect width="100%" height="100%" fill="url(#vignette)"/>
    </svg>`
  );
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

    // Scale the card to leave margin so the spotlight reads around it, while
    // maintaining its aspect ratio.
    const cardMaxWidth = Math.round(templateWidth * 0.84);
    const cardMaxHeight = Math.round(templateHeight * 0.88);

    let cardWidth = cardMaxWidth;
    let cardHeight = (cardMaxWidth / originalWidth) * originalHeight;

    if (cardHeight > cardMaxHeight) {
      cardHeight = cardMaxHeight;
      cardWidth = (cardMaxHeight / originalHeight) * originalWidth;
    }

    // Center card in template
    const cardX = Math.round((templateWidth - cardWidth) / 2);
    const cardY = Math.round((templateHeight - cardHeight) / 2);

    // Resize the card (preserve any transparency so the backdrop shows through).
    const resizedCard = await sharp(imageBuffer)
      .resize(Math.round(cardWidth), Math.round(cardHeight), {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Rasterise the studio backdrop, then composite the card centred on it.
    const backdrop = await sharp(studioBackdropSvg(templateWidth, templateHeight))
      .png()
      .toBuffer();

    const composite = await sharp(backdrop)
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
