// Shrinks a logo (a picked file or a saved image URL) to a small JPEG for
// "Match heading to logo", so it fits the API's 256 KB JSON body. Transparent
// logos are flattened onto mid-grey so white and black lettering both show.
// The stored logo is never touched. docs/organiser-heading-style.md
const MAX_EDGE = 768;
const MAX_BASE64_CHARS = 230_000;

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('That logo couldn’t be opened as an image.'));
  img.src = src;
});

/** @returns {Promise<{ media_type: 'image/jpeg', data: string }>} */
export async function logoForReading(fileOrUrl) {
  const isFile = typeof fileOrUrl !== 'string';
  const src = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
  try {
    const img = await loadImage(src);
    for (const [edge, quality] of [[MAX_EDGE, 0.85], [MAX_EDGE, 0.6], [512, 0.6]]) {
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight, 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', quality).split(',')[1] || '';
      if (data && data.length <= MAX_BASE64_CHARS) return { media_type: 'image/jpeg', data };
    }
    throw new Error('That logo is too detailed to read — try a simpler image.');
  } finally {
    if (isFile) URL.revokeObjectURL(src);
  }
}
