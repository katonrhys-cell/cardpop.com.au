import logger from './logger.js';

// sharp is loaded lazily, mirroring getSharp() in imageProcessor.js: it's a
// native module whose binary loads at import time, and this file is reached
// from routes/index.js — a top-level import would put sharp on EVERY cold
// start of the serverless function (and a binary-load failure would crash the
// whole app rather than just image handling).
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

// Server-side counterpart to utils/compressImage.js (which is browser/canvas based).
// Used for images that reach the backend as Buffers — e.g. AI/OCR scan uploads,
// which arrive at full camera resolution (~3-4 MB each).
//
// Conservative by design: re-encodes in the SAME format so storage paths/URLs
// stay valid, and returns the original buffer if compression isn't worthwhile
// or fails, so an upload can never be blocked.

const FORMAT_BY_MIME = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * @param {Buffer} buffer        Raw image bytes.
 * @param {string} mimetype      Original content type (e.g. "image/jpeg").
 * @param {object} [options]     { maxEdge=2000, quality=85, minBytes=150000, minSavings=0.1 }
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export async function compressImageBuffer(buffer, mimetype, options = {}) {
  const { maxEdge = 2000, quality = 85, minBytes = 150000, minSavings = 0.1 } = options;

  const format = FORMAT_BY_MIME[mimetype];
  if (!format || !Buffer.isBuffer(buffer) || buffer.length < minBytes) {
    return { buffer, contentType: mimetype };
  }

  try {
    const sharp = await getSharp();
    const pipeline = sharp(buffer, { failOn: 'none' })
      .rotate() // bake in EXIF orientation
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });

    const encoded =
      format === 'png'
        ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
        : format === 'webp'
          ? await pipeline.webp({ quality }).toBuffer()
          : await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

    // Only use it if it actually saved meaningful space.
    if (encoded.length >= buffer.length * (1 - minSavings)) {
      return { buffer, contentType: mimetype };
    }
    return { buffer: encoded, contentType: mimetype };
  } catch (err) {
    logger?.warn?.(`Image compression failed, using original: ${err.message}`);
    return { buffer, contentType: mimetype };
  }
}

export default compressImageBuffer;
