// How an event poster sits in a card's fixed-height image frame.
//
// 'cover' (the default) fills the frame edge to edge, so there is never a
// band between the card border and the photo. Only when the poster's shape is
// far from the frame's — a tall portrait flyer in a wide frame — would cover
// crop most of it, so that case is 'contain' (shown whole over a blurred copy).
export const COVER_MAX_STRETCH = 1.6;

export function imageFitForRatio(imageRatio, frameRatio) {
  if (!(imageRatio > 0) || !(frameRatio > 0)) return 'cover';
  const stretch = imageRatio / frameRatio;
  return stretch > COVER_MAX_STRETCH || stretch < 1 / COVER_MAX_STRETCH ? 'contain' : 'cover';
}

// `img` is the loaded <img>; its parent is the frame.
export function eventImageFit(img) {
  const frame = img?.parentElement;
  const iw = img?.naturalWidth;
  const ih = img?.naturalHeight;
  const fw = frame?.clientWidth;
  const fh = frame?.clientHeight;
  if (!iw || !ih || !fw || !fh) return 'cover';
  return imageFitForRatio(iw / ih, fw / fh);
}
