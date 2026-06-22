/**
 * Lazy loader for OpenCV.js (@techstark/opencv-js).
 *
 * The library is ~10MB of wasm-backed JS, so it is dynamically imported only
 * when the auto-crop feature is actually used — Vite splits it into its own
 * chunk that never loads on a normal page view. The returned promise resolves
 * once the wasm runtime has finished initialising (cv.Mat becomes available).
 */

let cvPromise = null;

export function loadOpenCV() {
  if (cvPromise) return cvPromise;

  cvPromise = import('@techstark/opencv-js')
    .then(mod => {
      const cv = mod.default ?? mod;
      // The runtime may already be initialised (cv.Mat present) or still
      // booting — in which case onRuntimeInitialized fires when it's ready.
      return new Promise(resolve => {
        if (cv.Mat) {
          resolve(cv);
          return;
        }
        cv.onRuntimeInitialized = () => resolve(cv);
      });
    })
    .catch(err => {
      // Reset so a later attempt can retry rather than caching the failure.
      cvPromise = null;
      throw err;
    });

  return cvPromise;
}
