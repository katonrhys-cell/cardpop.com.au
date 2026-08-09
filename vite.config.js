import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Beasties from 'beasties';
import { patchOpenCvSource } from './tools/opencvCspPatch.mjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const allDeps = Object.keys(pkg.dependencies || {});

// After the build, emit two HTML entries from one Vite-built index.html:
//   • index.html — the "/"-only document, with the static hero shell injected
//     into #root so the LCP paints from HTML before any JS runs (Vercel serves
//     this for "/" via the filesystem index).
//   • app.html   — a shell-less copy served for every OTHER route via the
//     catch-all rewrite in vercel.json, so those pages never flash the homepage
//     hero. Both reference the identical hashed JS/CSS, so the SPA boots the same.
// CSP `strict-dynamic` bootstrap. The parser-inserted module entry tag can't be
// allowlisted by hash in a static vercel.json (its filename hash changes every
// build), so we swap it for this CONSTANT inline script: the build-varying bits
// (entry URL + modulepreload list) travel in data attributes, which a CSP hash
// does not cover — the script text (and therefore its sha256 in vercel.json's
// script-src) stays identical across builds. The bootstrap re-injects the
// preloads and a module <script> for the entry; being non-parser-inserted,
// both are trusted under 'strict-dynamic'. (It must NOT use dynamic import()
// for the entry — Chrome does not extend strict-dynamic trust to import()
// from classic scripts, only to injected script elements and to import()
// from module scripts.) The v() path check pins loads to same-origin
// /assets/*.js so a markup-injected copy of this hashed script can't be
// aimed at a foreign URL, and the one-off Trusted Types policy satisfies
// require-trusted-types-for before the app's default policy exists.
// If you change this string you MUST update the sha256 in vercel.json — the
// build fails with the new value otherwise.
// data-preload-low is a second, OPTIONAL list injected with fetchPriority="low"
// (a no-op expando in browsers without fetchpriority support): the homepage's
// lazy route chunks preload there so they fill spare bandwidth without
// competing with the critical entry/vendor chunks. It must be injected via
// this trusted script, not as parser-inserted <link> tags — under
// 'strict-dynamic' the browser blocks modulepreloads that don't originate
// from an already-trusted script.
const CSP_BOOTSTRAP = '(function(){var s=document.currentScript,d=s.dataset,h=document.head;function v(p){return p.lastIndexOf("/assets/",0)===0&&p.indexOf("..")<0&&p.slice(-3)===".js"}function ld(t,lo){(t||"").split(",").forEach(function(p){if(v(p)){var l=document.createElement("link");l.rel="modulepreload";l.href=p;l.crossOrigin="";if(lo)l.fetchPriority="low";h.appendChild(l)}})}var tt=window.trustedTypes,pol=tt&&tt.createPolicy?tt.createPolicy("cardpop#bootstrap",{createScriptURL:function(u){return u}}):null;ld(d.preload);if(v(d.entry)){var m=document.createElement("script");m.type="module";m.crossOrigin="";m.src=pol?pol.createScriptURL(d.entry):d.entry;h.appendChild(m)}ld(d.preloadLow,1)})()';

const ENTRY_SCRIPT_RE = /<script type="module" crossorigin src="([^"]+)"><\/script>/;

function applyCspBootstrap(html, warn) {
	const entryMatch = html.match(ENTRY_SCRIPT_RE);
	if (!entryMatch) {
		warn('csp-bootstrap: module entry <script> not found — HTML left untouched');
		return html;
	}
	const preloads = [];
	html = html.replace(/\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g, (_, href) => {
		preloads.push(href);
		return '';
	});
	return html.replace(
		ENTRY_SCRIPT_RE,
		`<script data-entry="${entryMatch[1]}" data-preload="${preloads.join(',')}">${CSP_BOOTSTRAP}</script>`
	);
}

// Guard against drift: the bootstrap text emitted into the final HTML (after
// beasties re-serialization) must still hash to the value pinned in
// vercel.json's script-src, or the browser will refuse to run the app.
function verifyCspBootstrap(ctx, htmlFiles) {
	const hash = `'sha256-${createHash('sha256').update(CSP_BOOTSTRAP, 'utf8').digest('base64')}'`;
	const vercelCfg = readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf-8');
	if (!vercelCfg.includes(hash)) {
		ctx.error(`csp-bootstrap: vercel.json script-src is missing ${hash} — update every Content-Security-Policy header`);
	}
	for (const file of htmlFiles) {
		const emitted = readFileSync(file, 'utf-8').match(/<script data-entry[^>]*>([\s\S]*?)<\/script>/);
		if (!emitted) continue; // applyCspBootstrap already warned
		if (emitted[1] !== CSP_BOOTSTRAP) {
			ctx.error(`csp-bootstrap: inline bootstrap in ${file} was altered post-transform — its hash no longer matches vercel.json`);
		}
	}
}

// Walk a route entry chunk's static import graph and return every JS chunk
// (and imported CSS file) it needs. Used to extend index.html's modulepreload
// list with the homepage's lazy chunk graph: without this, the browser learns
// about HomePage.jsx (and its ~50 icon/component chunks) only AFTER the entry
// bundle has downloaded, parsed and mounted React — a second full network
// round-trip that stretches the static-shell → full-render gap by seconds on
// mobile. Preloading them in parallel with the critical path collapses that
// waterfall. Only index.html gets this (it is only ever served for "/");
// app.html routes vary, so they keep the default on-demand loading.
function collectRouteChunkFiles(bundle, facadeSuffix) {
	const entryFile = Object.keys(bundle).find((f) => {
		const c = bundle[f];
		return c.type === 'chunk' && c.facadeModuleId?.endsWith(facadeSuffix);
	});
	if (!entryFile) return null;
	const js = [];
	const css = new Set();
	const seen = new Set();
	const visit = (file) => {
		if (seen.has(file)) return;
		seen.add(file);
		const chunk = bundle[file];
		if (!chunk || chunk.type !== 'chunk') return;
		js.push(file);
		for (const c of chunk.viteMetadata?.importedCss ?? []) css.add(c);
		for (const imp of chunk.imports ?? []) visit(imp);
	};
	visit(entryFile);
	return { js, css: [...css] };
}

// Append the "/" route's chunk files to the CSP bootstrap's data-preload
// list (deduped against the critical-path preloads already there) and emit
// <link rel="preload" as="style"> for its CSS. Attribute-only change: the
// bootstrap script text — and therefore its CSP hash — is untouched.
// facadeSuffix picks WHICH route's graph to preload: the homepage normally,
// but the /launch page in coming-soon builds (see homeShellPlugin) — "/"
// immediately redirects there, so preloading HomePage's ~25 chunks was pure
// wasted bandwidth on every visit.
function addHomeRoutePreloads(html, bundle, warn, facadeSuffix) {
	const files = collectRouteChunkFiles(bundle, facadeSuffix);
	if (!files) {
		warn(`home-shell: ${facadeSuffix} chunk not found in bundle — route preloads skipped`);
		return html;
	}
	const preloadAttr = html.match(/data-preload="([^"]*)"/);
	const entryAttr = html.match(/data-entry="([^"]*)"/);
	if (!preloadAttr) {
		warn('home-shell: data-preload attribute not found — route preloads skipped');
		return html;
	}
	const existing = new Set(preloadAttr[1].split(',').filter(Boolean));
	if (entryAttr) existing.add(entryAttr[1]);
	const extra = files.js.map((f) => `/${f}`).filter((f) => !existing.has(f));
	if (extra.length > 0) {
		// Low-priority list so these never contend with the critical-path chunks
		// (see the data-preload-low note above CSP_BOOTSTRAP).
		html = html.replace(preloadAttr[0], `${preloadAttr[0]} data-preload-low="${extra.join(',')}"`);
	}
	// Chunks shared with the entry report the main index-*.css as their imported
	// CSS — skip anything the document already references (it's inlined/preloaded
	// separately) so only genuinely lazy stylesheets get a preload.
	const cssPreloads = files.css
		.filter((f) => !html.includes(`href="/${f}"`))
		.map((f) => `<link rel="preload" as="style" fetchpriority="low" crossorigin href="/${f}">`)
		.join('');
	if (cssPreloads) html = html.replace('</head>', `${cssPreloads}</head>`);
	return html;
}

// The metric-adjusted fallback face for Syne, injected into the "/" document's
// critical CSS after beasties runs (beasties' inlineFonts keeps url() faces like
// Syne itself but drops local()-only faces, so this one needs manual injection).
// It must be available before the full stylesheet arrives: the hero <h1> — the
// homepage LCP element — paints from the static shell with this fallback, and
// its size-adjust is deliberately oversized so no later Syne repaint can become
// a larger LCP candidate (see index.css). Keep in sync with index.css.
const SYNE_FALLBACK_FONT_FACE =
	"@font-face{font-family:'Syne Fallback';src:local('Arial'),local('Roboto'),local('Liberation Sans'),local('DejaVu Sans');ascent-override:94%;descent-override:26%;line-gap-override:0%;size-adjust:115%}";

// Normalise a bare host or full URL to an origin (`https://img.cardpop.com.au`),
// mirroring normalizeCdnHost in utils/imageUrl.js. Returns null when unset.
function cdnPreconnectOrigin(host) {
	if (!host || typeof host !== 'string') return null;
	const trimmed = host.trim().replace(/\/+$/, '');
	if (!trimmed) return null;
	try {
		return new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`).origin;
	} catch {
		return null;
	}
}

// Add a preconnect to the image CDN into a document's <head>, if one is
// configured. No-op (returns the HTML unchanged) when VITE_IMAGE_CDN_HOST is
// unset or the head marker is missing. Used for app.html only — see caller.
function injectImageCdnPreconnect(html, warn) {
	const origin = cdnPreconnectOrigin(process.env.VITE_IMAGE_CDN_HOST);
	if (!origin) return html;
	if (html.includes(`preconnect" href="${origin}"`)) return html;
	const tag = `<link rel="preconnect" href="${origin}" crossorigin />`;
	if (!html.includes('</head>')) {
		warn?.('image-cdn-preconnect: no </head> found — preconnect not injected');
		return html;
	}
	return html.replace('</head>', `    ${tag}\n  </head>`);
}

function homeShellPlugin() {
	// Coming-soon builds redirect "/" to /launch on mount, so the static shell
	// and the preloaded route graph must both be the LAUNCH page's — otherwise
	// the LCP paints homepage content that's immediately replaced, and ~25
	// homepage chunks download only to be thrown away (VITE_COMING_SOON is a
	// build-time env var, same as its use in App.jsx).
	const comingSoon = process.env.VITE_COMING_SOON === 'true';
	const shellPath = path.resolve(__dirname, comingSoon ? 'tools/launch-shell.html' : 'tools/home-shell.html');
	const routeFacade = comingSoon ? 'pages/LaunchPage.jsx' : 'pages/HomePage.jsx';
	return {
		name: 'cardpop-home-shell',
		apply: 'build',
		async writeBundle(outputOptions, bundle) {
			const outDir = outputOptions.dir || path.resolve(__dirname, 'dist');
			const indexPath = path.join(outDir, 'index.html');
			if (!existsSync(indexPath)) return;

			const builtIndex = applyCspBootstrap(readFileSync(indexPath, 'utf-8'), (m) => this.warn(m));

			// Content routes (marketplace, shop, product, category…) render an
			// above-the-fold card image from the image CDN as their LCP element, so
			// warming that origin's DNS/TCP/TLS ahead of the image request shaves
			// meaningful time off mobile LCP. This preconnect goes ONLY into app.html
			// — the homepage (index.html) paints a text <h1> with no above-fold
			// image, so it keeps the "preconnect only to first-paint origins" rule.
			// Gated on VITE_IMAGE_CDN_HOST (a real build-time env var on Vercel) so
			// there's never a wasted preconnect when the CDN is disabled — images
			// then come from Supabase, which is already preconnected.
			const appHtml = injectImageCdnPreconnect(builtIndex, (m) => this.warn(m));
			// Shell-less document for all non-root routes (CSS stays render-blocking
			// there — those pages are React-gated, so it costs them nothing).
			writeFileSync(path.join(outDir, 'app.html'), appHtml, 'utf-8');

			// Inject the hero shell into the "/"-only index.html.
			const marker = '<div id="root"></div>';
			if (!builtIndex.includes(marker)) {
				this.warn('home-shell: `<div id="root"></div>` not found — shell not injected');
				return;
			}
			const shell = readFileSync(shellPath, 'utf-8');
			let indexHtml = builtIndex.replace(marker, `<div id="root">${shell}</div>`);

			// Inline the above-the-fold critical CSS and load the full stylesheet
			// asynchronously so it no longer blocks the shell's first paint. The
			// classic media="print"/onload swap uses an inline handler that our
			// hardened CSP (no 'unsafe-inline' in script-src) blocks, so we strip
			// beasties' onload and let main.jsx flip [data-async-style] to media
			// "all" instead. Fail-safe: any error keeps the render-blocking link.
			try {
				const beasties = new Beasties({
					path: outDir,
					publicPath: '/',
					preload: 'media',
					pruneSource: false,
					// Inline the @font-face declarations (Syne + metric-adjusted 'Syne
					// Fallback') into the critical CSS. Without them the shell's hero
					// <h1> paints in an arbitrary system font with no size-adjust, so
					// the later React repaint registers as a larger LCP candidate and
					// drags LCP from ~0.8s to whenever the JS bundle lands (see the
					// 'Syne Fallback' comment in index.css).
					inlineFonts: true,
					preloadFonts: false,
					logLevel: 'silent',
				});
				const processed = await beasties.process(indexHtml);
				indexHtml = processed.replace(/ onload="this\.media='all'"/g, ' data-async-style');

				// The deferred (media="print") stylesheet is fetched at the browser's
				// LOWEST priority, so on slow connections it loses the bandwidth race
				// against the JS chunks — and main.jsx gates the React mount on it
				// (2s fail-safe), leaving the static shell up even after the JS is
				// ready. A preload at as="style" priority makes it arrive alongside
				// the critical JS instead; same URL, so no double-download.
				indexHtml = indexHtml.replace(
					/<link rel="stylesheet"([^>]*?) media="print" data-async-style>/g,
					(tag, attrs) => {
						const href = attrs.match(/href="([^"]+)"/)?.[1];
						return href ? `<link rel="preload" as="style" crossorigin href="${href}">${tag}` : tag;
					},
				);
			} catch (e) {
				this.warn(`home-shell: critical-CSS inlining skipped (${e.message}); CSS stays render-blocking`);
			}

			// Preload the "/" route's lazy chunk graph in parallel with the
			// critical path (see collectRouteChunkFiles above).
			indexHtml = addHomeRoutePreloads(indexHtml, bundle, (m) => this.warn(m), routeFacade);

			// Beasties drops the local()-only 'Syne Fallback' face from the inlined
			// critical CSS — put it back so the shell's LCP <h1> paints with the
			// oversized metric-adjusted fallback (see SYNE_FALLBACK_FONT_FACE above).
			if (indexHtml.includes('<style>')) {
				indexHtml = indexHtml.replace('<style>', `<style>${SYNE_FALLBACK_FONT_FACE}`);
			} else {
				this.warn('home-shell: no inline <style> found — Syne Fallback face not injected');
			}

			writeFileSync(indexPath, indexHtml, 'utf-8');
			verifyCspBootstrap(this, [indexPath, path.join(outDir, 'app.html')]);
		},
	};
}

// The production CSP has no 'unsafe-eval', but the OpenCV.js build generates
// its embind invokers with `new Function` at wasm init — so in production the
// script executed, cv never initialised, and card auto-crop always failed with
// "The card detector could not load". Rewrite the emitted asset's codegen into
// the equivalent closures (Emscripten's own DYNAMIC_EXECUTION=0 shapes) so it
// runs under the strict CSP. Dev is unaffected (no CSP, and the dev server
// serves the file straight from node_modules). patchOpenCvSource throws on any
// drift, so an opencv-js upgrade fails the build rather than shipping a crop
// feature that needs 'unsafe-eval'. See tools/opencvCspPatch.mjs.
function opencvCspPatchPlugin() {
	return {
		name: 'cardpop-opencv-csp-patch',
		apply: 'build',
		generateBundle(_options, bundle) {
			const asset = Object.values(bundle).find(
				(a) => a.type === 'asset' && /(^|\/)opencv-[\w-]+\.js$/.test(a.fileName),
			);
			// The asset only exists in builds that include the loader chunk (the
			// main app build; not e.g. a route-scoped harness build without it).
			if (!asset) return;
			try {
				asset.source = patchOpenCvSource(asset.source.toString());
			} catch (e) {
				this.error(e.message);
			}
		},
	};
}

console.warn = () => { };

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

export default defineConfig({
	optimizeDeps: {
		include: allDeps,
	},
	customLogger: logger,
	plugins: [
		react(),
		homeShellPlugin(),
		opencvCspPatchPlugin(),
	],
	server: {
		port: 3000,
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: [
			'.app-preview.com',
			'.app-preview.io',
		],
		fs: {
			strict: true,
			allow: [
				path.resolve(__dirname),
				path.join(path.resolve(__dirname, '../..'), 'node_modules'),
			],
		},
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
	build: {
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types',
				'onnxruntime-web',
				'onnxruntime-web/webgpu',
			],
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) return;
					// React core (incl. react/jsx-runtime + scheduler) MUST get its own
					// chunk. Otherwise rolldown co-locates jsx-runtime into whichever
					// vendor chunk it lands in (it was ending up in vendor-motion), and
					// because every component imports jsx-runtime the entry then statically
					// pulls that whole chunk — dragging framer-motion onto the critical
					// path. Keeping React isolated lets framer-motion stay lazy-only.
					// Match the actual react / react-dom / scheduler packages only —
					// NOT scoped packages whose path merely contains "/react/" (e.g.
					// @sentry/react), which a loose includes('/react/') would wrongly
					// pull into vendor-react and drag onto the critical path.
					if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
					// NOTE: lucide-react is deliberately NOT forced into one manual chunk.
					// A single vendor-icons chunk dragged EVERY icon used anywhere in the
					// app (~45 KB) onto the critical path, because the eager Header/hero
					// import a handful of icons and the whole chunk came with them.
					// Letting rolldown auto-split keeps eager icons tiny while each page's
					// icons ride along with that page's lazy chunk.
					// NOTE: framer-motion is deliberately NOT forced into its own manual
					// chunk. When it was, rolldown hoisted a shared react/jsx-runtime
					// helper into that chunk, and because the eager entry needs jsx-runtime
					// it then statically imported the whole framer-motion chunk — putting
					// ~37 KB of animation code on the critical path even though only lazy
					// pages use it. Letting rolldown auto-split framer-motion keeps it off
					// the initial load (loaded on-demand with the pages that animate).
					// NOTE: @radix-ui is deliberately NOT forced into one manual chunk.
					// The eager Header only needs a couple of primitives (dialog/slot),
					// but a single vendor-radix chunk dragged EVERY radix primitive used
					// anywhere (select, popover, accordion, tabs…) onto the critical path
					// — ~89 KB gzip of mostly-unused JS at first paint. Letting rolldown
					// auto-split radix keeps the shared core eager while each primitive
					// rides along with the lazy page that actually uses it.
					if (id.includes('react-router')) return 'vendor-router';
					// NOTE: react-hook-form / zod / @hookform are deliberately NOT forced
					// into a vendor-forms chunk. Because react-hook-form imports
					// react/jsx-runtime, rolldown hoisted a shared react helper into that
					// chunk; the eager entry needs jsx-runtime, so it statically pulled the
					// whole vendor-forms chunk — dragging ~40 KB gzip of zod + react-hook-form
					// onto the critical path even though only lazy form pages (login, signup,
					// checkout, admin) use them. Same failure mode documented for
					// framer-motion and radix above. Letting rolldown auto-split forms keeps
					// them off first paint, riding along with the lazy page that needs them.
					if (id.includes('@sentry')) return 'vendor-sentry';
					if (id.includes('date-fns') || id.includes('react-day-picker')) return 'vendor-dates';
					// NOTE: @stripe is deliberately NOT forced into a vendor-stripe chunk.
					// Same failure mode as framer-motion/radix/forms above: rolldown
					// hoisted a shared prop-types helper into the forced chunk, and since
					// the eager entry needs prop-types it statically imported the whole
					// Stripe loader on first paint — even though only the lazy checkout
					// page uses it. Auto-splitting lets Stripe ride with CheckoutPage.
				},
			},
		}
	}
});
