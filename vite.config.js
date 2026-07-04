import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Beasties from 'beasties';

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
const CSP_BOOTSTRAP = '(function(){var s=document.currentScript,d=s.dataset,h=document.head;function v(p){return p.lastIndexOf("/assets/",0)===0&&p.indexOf("..")<0&&p.slice(-3)===".js"}var tt=window.trustedTypes,pol=tt&&tt.createPolicy?tt.createPolicy("cardpop#bootstrap",{createScriptURL:function(u){return u}}):null;(d.preload||"").split(",").forEach(function(p){if(v(p)){var l=document.createElement("link");l.rel="modulepreload";l.href=p;l.crossOrigin="";h.appendChild(l)}});if(v(d.entry)){var m=document.createElement("script");m.type="module";m.crossOrigin="";m.src=pol?pol.createScriptURL(d.entry):d.entry;h.appendChild(m)}})()';

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

function homeShellPlugin() {
	const shellPath = path.resolve(__dirname, 'tools/home-shell.html');
	return {
		name: 'cardpop-home-shell',
		apply: 'build',
		async writeBundle(outputOptions) {
			const outDir = outputOptions.dir || path.resolve(__dirname, 'dist');
			const indexPath = path.join(outDir, 'index.html');
			if (!existsSync(indexPath)) return;

			const builtIndex = applyCspBootstrap(readFileSync(indexPath, 'utf-8'), (m) => this.warn(m));
			// Shell-less document for all non-root routes (CSS stays render-blocking
			// there — those pages are React-gated, so it costs them nothing).
			writeFileSync(path.join(outDir, 'app.html'), builtIndex, 'utf-8');

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
					inlineFonts: false,
					preloadFonts: false,
					logLevel: 'silent',
				});
				const processed = await beasties.process(indexHtml);
				indexHtml = processed.replace(/ onload="this\.media='all'"/g, ' data-async-style');
			} catch (e) {
				this.warn(`home-shell: critical-CSS inlining skipped (${e.message}); CSS stays render-blocking`);
			}

			writeFileSync(indexPath, indexHtml, 'utf-8');
			verifyCspBootstrap(this, [indexPath, path.join(outDir, 'app.html')]);
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
					// NOTE: framer-motion is deliberately NOT forced into its own manual
					// chunk. When it was, rolldown hoisted a shared react/jsx-runtime
					// helper into that chunk, and because the eager entry needs jsx-runtime
					// it then statically imported the whole framer-motion chunk — putting
					// ~37 KB of animation code on the critical path even though only lazy
					// pages use it. Letting rolldown auto-split framer-motion keeps it off
					// the initial load (loaded on-demand with the pages that animate).
					if (id.includes('lucide-react')) return 'vendor-icons';
					// NOTE: @radix-ui is deliberately NOT forced into one manual chunk.
					// The eager Header only needs a couple of primitives (dialog/slot),
					// but a single vendor-radix chunk dragged EVERY radix primitive used
					// anywhere (select, popover, accordion, tabs…) onto the critical path
					// — ~89 KB gzip of mostly-unused JS at first paint. Letting rolldown
					// auto-split radix keeps the shared core eager while each primitive
					// rides along with the lazy page that actually uses it.
					if (id.includes('react-router')) return 'vendor-router';
					if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'vendor-forms';
					if (id.includes('@sentry')) return 'vendor-sentry';
					if (id.includes('date-fns') || id.includes('react-day-picker')) return 'vendor-dates';
					if (id.includes('@stripe') || id.includes('stripe')) return 'vendor-stripe';
				},
			},
		}
	}
});
