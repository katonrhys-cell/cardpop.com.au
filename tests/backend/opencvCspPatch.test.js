/**
 * Guards the build-time CSP patch for OpenCV.js (tools/opencvCspPatch.mjs).
 *
 * The production CSP has no 'unsafe-eval', and the @techstark/opencv-js embind
 * build generates its invokers with `new Function` at wasm init — unpatched, it
 * throws mid-init in production and card auto-crop dies with "The card detector
 * could not load". These tests run the patch against the actual installed
 * package, so a version bump that changes the embind glue fails here (and in
 * the build, which applies the same patch) instead of silently shipping a crop
 * feature that needs 'unsafe-eval' again.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { patchOpenCvSource } from '../../tools/opencvCspPatch.mjs';

const OPENCV_DIST = new URL(
  '../../node_modules/@techstark/opencv-js/dist/opencv.js',
  import.meta.url,
);

describe('patchOpenCvSource', () => {
  const source = readFileSync(OPENCV_DIST, 'utf8');

  it('removes every dynamic-codegen site from the installed opencv.js build', () => {
    const patched = patchOpenCvSource(source);
    // No eval-equivalent construction may survive: direct `new Function` or
    // the embind `new_(Function, ...)` indirection.
    expect(patched).not.toMatch(/new Function\(/);
    expect(patched).not.toMatch(/new_\(Function/);
    // The closure replacements actually landed.
    expect(patched).toContain('expectedArgCount');
    expect(patched).toContain('__emval_addMethodCaller(invokerFunction)}');
  });

  it('stops fetching the embedded data-URI wasm (connect-src would block it)', () => {
    const patched = patchOpenCvSource(source);
    expect(patched).toContain(
      'function getBinaryPromise(){if(!wasmBinary&&(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER)&&!isDataURI(wasmBinaryFile)&&typeof fetch==="function")',
    );
  });

  it('throws loudly when the expected embind glue is missing', () => {
    // Simulates an opencv-js upgrade that reshapes the code the patch targets:
    // patching must fail (which fails the Vite build) rather than emit a file
    // that still needs 'unsafe-eval'.
    expect(() => patchOpenCvSource('var cv = {};')).toThrow(/opencv-csp-patch/);
  });

  it('throws when a codegen site survives patching', () => {
    // A source where all four known sites exist but an extra `new Function`
    // hides elsewhere must be rejected by the residual-codegen check.
    const patched = patchOpenCvSource(source);
    expect(() => patchOpenCvSource(source + ';var sneaky=new Function("x","return x");'))
      .toThrow(/dynamic code generation remains/);
    // Sanity: the unmodified patch output passes the same check implicitly.
    expect(patched.length).toBeGreaterThan(0);
  });
});
