/**
 * Lazy loader for OpenCV.js (@techstark/opencv-js).
 *
 * The library is ~10MB of wasm-backed JS, so it is loaded only when the
 * auto-crop feature is actually used — nothing here runs on a normal page view.
 *
 * It is deliberately loaded as a classic <script> tag rather than import().
 * The file is an Emscripten build whose exported Module carries a legacy
 * `then` property, and handing that object to any promise chain (dynamic
 * import interop, `resolve(cv)`, a plain `await`) makes the promise machinery
 * "adopt" it: it calls `Module.then(cb)`, the callback receives the Module —
 * which is thenable again — and adoption recurses forever. The promise never
 * settles, so every detection hung and the whole crop feature appeared dead.
 * A script tag sidesteps every promise-interop layer: we read `window.cv`,
 * wait for the wasm runtime to initialise, and delete the legacy `then` so no
 * later `await` can trip over it.
 */

// eslint-disable-next-line import/no-unresolved -- Vite `?url` asset suffix, invisible to the node resolver
import cvScriptUrl from '@techstark/opencv-js/dist/opencv.js?url';

let cvPromise = null;

function whenRuntimeReady(cv, resolve) {
  // Strip the legacy Emscripten thenable *before* this object can become a
  // promise resolution value — see the module comment.
  delete cv.then;
  if (cv.Mat) {
    resolve(cv);
    return;
  }
  const prev = cv.onRuntimeInitialized;
  cv.onRuntimeInitialized = () => {
    if (typeof prev === 'function') prev();
    resolve(cv);
  };
}

export function loadOpenCV() {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('OpenCV.js requires a browser environment'));
      return;
    }
    // Already on the page (earlier load, HMR) — just wait for the runtime.
    if (window.cv && (window.cv.Mat || typeof window.cv.then === 'function' || window.cv.onRuntimeInitialized !== undefined)) {
      whenRuntimeReady(window.cv, resolve);
      return;
    }
    const script = document.createElement('script');
    script.src = cvScriptUrl;
    script.async = true;
    script.onload = () => {
      if (!window.cv) {
        reject(new Error('OpenCV.js loaded but window.cv is missing'));
        return;
      }
      whenRuntimeReady(window.cv, resolve);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Failed to load OpenCV.js'));
    };
    document.head.appendChild(script);
  }).catch(err => {
    // Reset so a later attempt can retry rather than caching the failure.
    cvPromise = null;
    throw err;
  });

  return cvPromise;
}
