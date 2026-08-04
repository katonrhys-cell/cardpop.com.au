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

// Script downloaded but the wasm runtime never came up — give up after this
// long so the promise rejects (and resets for retry) instead of wedging the
// crop feature for the whole session.
const RUNTIME_INIT_TIMEOUT_MS = 30_000;

let cvPromise = null;

function whenRuntimeReady(cv, resolve, reject) {
  // Strip the legacy Emscripten thenable *before* this object can become a
  // promise resolution value — see the module comment.
  delete cv.then;
  if (cv.Mat) {
    resolve(cv);
    return;
  }
  // The script can execute and still never initialise: wasm instantiation can
  // abort (iOS Safari under memory pressure is the classic case), and then
  // onRuntimeInitialized simply never fires. Both failure paths must reject —
  // a forever-pending promise here leaves the UI spinning and, because it
  // stays cached, bricks every later attempt too.
  const timer = setTimeout(
    () => reject(new Error('OpenCV runtime initialisation timed out')),
    RUNTIME_INIT_TIMEOUT_MS,
  );
  cv.onAbort = (what) => {
    clearTimeout(timer);
    reject(new Error(`OpenCV runtime aborted: ${what}`));
  };
  const prev = cv.onRuntimeInitialized;
  cv.onRuntimeInitialized = () => {
    clearTimeout(timer);
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
      whenRuntimeReady(window.cv, resolve, reject);
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
      whenRuntimeReady(window.cv, resolve, reject);
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
