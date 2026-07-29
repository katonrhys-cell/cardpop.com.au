/**
 * Runs the browser-only rectification step for the scoring harness.
 *
 * `utils/analysisImage.js` needs a canvas and the OpenCV wasm build, so it
 * cannot run in Node. Approximating it with sharp would measure something
 * production never does, so instead the harness page is built with Vite and
 * driven in headless Chromium — the real module, on the real image.
 *
 * The page is *built* rather than dev-served: Vite's dev transform of the ~10 MB
 * OpenCV module takes long enough to look like a hang, while the production
 * build chunks it in under a second.
 *
 * Chromium is pre-installed in the dev container at a stable symlink; Playwright
 * pins its own build number and would otherwise demand `playwright install`.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(REPO_ROOT, '.harness-dist');
const PAGE_PATH = 'scripts/card-identification/crop-harness.html';
const PREBUILT_CHROMIUM = '/opt/pw-browsers/chromium';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

/**
 * Serves the built page and its assets, falling back to the repo root so the
 * page can fetch fixture photos that live outside the build output.
 */
function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    for (const root of [OUT_DIR, REPO_ROOT]) {
      const filePath = path.resolve(root, rel);
      // Refuse to serve outside the roots we intend to expose.
      if (!filePath.startsWith(root)) continue;
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    res.writeHead(404).end('not found');
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * How long to give the one-off OpenCV warm-up before giving up on rectification
 * for this run.
 *
 * Evaluating the ~10 MB OpenCV module **blocks the renderer's main thread**
 * while Emscripten compiles it — the page cannot answer anything, not even a
 * one-line evaluate, until it finishes. On constrained hardware (this dev
 * container included) it does not finish in any reasonable time. So the warm-up
 * is bounded and its failure is not fatal: the run continues on the original
 * photos and says so.
 */
const WARM_UP_TIMEOUT_MS = 90_000;

/**
 * @param {{ warmUpTimeoutMs?: number }} [options]
 * @returns {Promise<{ rectify: (repoRelativePath: string, name: string) => Promise<{buffer: Buffer, cropped: boolean}>, close: () => Promise<void> }>}
 */
export async function createRectifier({ warmUpTimeoutMs = WARM_UP_TIMEOUT_MS } = {}) {
  // Imported lazily so a run with --no-crop needs neither Vite nor Playwright.
  const { build } = await import('vite');
  const { chromium } = await import('playwright');

  await build({
    root: REPO_ROOT,
    logLevel: 'error',
    configFile: false,
    resolve: { alias: { '@': REPO_ROOT } },
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      rollupOptions: { input: path.join(REPO_ROOT, PAGE_PATH) },
      chunkSizeWarningLimit: 100_000,
    },
  });

  const { server, port } = await startServer();

  const executablePath = process.env.CHROMIUM_PATH
    ?? (fs.existsSync(PREBUILT_CHROMIUM) ? PREBUILT_CHROMIUM : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(300_000);

  const shutdown = async () => {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  };

  try {
    await page.goto(`http://127.0.0.1:${port}/${PAGE_PATH}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true');

    // Pay the one-off wasm init here rather than inside the first card's budget,
    // and bound it — a renderer wedged compiling OpenCV never answers again, so
    // without this the whole scoring run would stall indefinitely.
    await Promise.race([
      page.evaluate(() => window.__warmUp()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          `OpenCV did not initialise within ${Math.round(warmUpTimeoutMs / 1000)}s`,
        )), warmUpTimeoutMs).unref?.(),
      ),
    ]);
  } catch (err) {
    await shutdown();
    throw err;
  }

  return {
    /**
     * @param {string} repoRelativePath - path under the repo root. The page
     *   fetches it over HTTP; passing megabytes through page.evaluate
     *   serialises as a JSON number array and is pathologically slow.
     */
    async rectify(repoRelativePath, name) {
      const result = await page.evaluate(
        ([url, fileName]) => window.__rectify(url, fileName),
        [`/${repoRelativePath.replace(/^\/+/, '')}`, name],
      );
      return { buffer: Buffer.from(result.base64, 'base64'), cropped: result.cropped };
    },
    close: shutdown,
  };
}
