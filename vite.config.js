import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import Beasties from 'beasties';
import { patchOpenCvSource } from './tools/opencvCspPatch.mjs';
import { appShellFromHomeShell } from './tools/appShell.mjs';
import { doctypeProblem } from './tools/doctype.mjs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
// Pre-bundle every runtime dependency — except those with no root entry point.
// @tiptap/pm only exports subpaths (@tiptap/pm/state, …); asking Vite to
// optimise its bare name fails the whole dev server at startup with
// '"." is not exported under the conditions […] from package @tiptap/pm'.
const hasRootEntry = (dep) => {
	try { createRequire(import.meta.url).resolve(dep); return true; } catch { return false; }
};
const allDeps = Object.keys(pkg.dependencies || {}).filter(hasRootEntry);

// After the build, emit two HTML entries from one Vite-built index.html:
//   • index.html — the "/"-only document, with the static hero shell injected
//     into #root so the LCP paints from HTML before any JS runs (Vercel serves
//     this for "/" via the filesystem index).
//   • app.html   — served for every OTHER route via the catch-all rewrite in
//     vercel.json. It carries the same shell CHROME (announcement bar, header,
//     cookie banner — tools/appShell.mjs derives it from the homepage shell)
//     with the route loader in place of the hero, so those pages paint their
//     header from HTML too instead of a blank page until React mounts, and
//     never flash the homepage hero. Both documents get the same critical-CSS
//     inlining and deferred stylesheet, and reference the identical hashed
//     JS/CSS, so the SPA boots the same.
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
// from an already-trusted script. (The list is present only on index.html —
// app.html serves every other route, so there is no single route graph to
// preload. It carries data-route-preload instead, see below.)
// data-route-preload (app.html only) is a map from route path to that
// route's lazy chunk graph: `path:name,name;path:name…`, where each name is a
// bare hashed chunk basename (the bootstrap re-adds /assets/ and .js, and v()
// still validates every URL). rp() picks the entry whose key equals the
// current pathname, or the longest key ending in "/" that prefixes it
// (`/marketplace/` → the product page), and preloads its chunks at low
// priority alongside the entry. Without it a route chunk is only discovered
// after the entry has downloaded, parsed and mounted React — a second full
// network round-trip that in Lighthouse's throttled simulation put the
// route's first text (its LCP) at 5–6 s on /shop and /events even with the
// header already painted from the static shell. The map is built per
// release from the bundle graph (ROUTE_PRELOADS in homeShellPlugin).
// data-css is the full stylesheet: the bootstrap injects its as="style"
// preload plus the media="print" <link data-async-style> that main.jsx flips
// to "all" once the bundle runs (see inlineCriticalCss below).
//
// PAINT FIRST, THEN FETCH. Everything above is injected one frame AFTER the
// first paint (requestAnimationFrame → setTimeout 0), not synchronously while
// the parser is still on this tag. The "/" document already carries its LCP
// hero in static HTML with the critical CSS inlined, so the paint needs none
// of these files — but Lighthouse's lab simulation (Lantern, which is what
// PageSpeed Insights reports) models every High-priority script and every
// VeryHigh-priority stylesheet whose request STARTED before the observed
// first paint as render-blocking, and that put ~240 KB of module preloads on
// the simulated FCP/LCP critical path (mobile FCP 1.5 s / LCP 2.7 s for a
// paint that in reality needs only the 12 KB document). Starting them after
// the frame has painted costs real visitors one frame (~16 ms) of JS boot and
// keeps the first paint's bandwidth for the HTML and the hero font. A hidden
// tab (no rAF) and a 1.5 s safety timer both fall straight through, so the
// app always boots.
//
// Before any of that, synchronously (so it lands before the first paint), it
// trims the static shell for returning visitors: the announcement bar is
// removed when this session dismissed it or a Supabase session is cached (a
// member never sees it), and the cookie banner when a consent choice is
// stored. The storage keys mirror components/AnnouncementBar.jsx,
// components/Header.jsx (optimisticAuth) and lib/consent.js — change them
// together. This tag sits in <head> (Vite puts the entry there), i.e. before
// the shell has parsed, so it hides by id via an injected <style> rule rather
// than touching elements that don't exist yet; the rule is a no-op on a
// document without those elements (the launch shell).
const CSP_BOOTSTRAP = '(function(){var s=document.currentScript,d=s.dataset,h=document.head,done=0;try{var hid=[];if(sessionStorage.getItem("cardpop_announcement_dismissed")==="1"||localStorage.getItem("sb-vrfsaazuqjxotnieqlkd-auth-token"))hid.push("#cardpop-shell-announcement");if(localStorage.getItem("cardpop_cookie_consent")!==null)hid.push("#cardpop-shell-cookie");if(hid.length){var st=document.createElement("style");st.textContent=hid.join(",")+"{display:none}";h.appendChild(st)}}catch(e){}function v(p,x){return!!p&&p.lastIndexOf("/assets/",0)===0&&p.indexOf("..")<0&&p.slice(-x.length)===x}function ld(t,lo){(t||"").split(",").forEach(function(p){if(v(p,".js")){var l=document.createElement("link");l.rel="modulepreload";l.href=p;l.crossOrigin="";if(lo)l.fetchPriority="low";h.appendChild(l)}})}function rp(){var m=d.routePreload;if(!m)return;var p=location.pathname,b=null,r="";while(p.length>1&&p.slice(-1)==="/")p=p.slice(0,-1);m.split(";").forEach(function(e){var i=e.indexOf(":");if(i<0)return;var k=e.slice(0,i);if((k===p||(k.slice(-1)==="/"&&p.lastIndexOf(k,0)===0))&&(b===null||k.length>b.length)){b=k;r=e.slice(i+1)}});if(b!==null)ld(r.split(",").map(function(n){return"/assets/"+n+".js"}).join(","),1)}function go(){if(done)return;done=1;var tt=window.trustedTypes,pol=tt&&tt.createPolicy?tt.createPolicy("cardpop#bootstrap",{createScriptURL:function(u){return u}}):null;if(v(d.css,".css")){var p=document.createElement("link");p.rel="preload";p.as="style";p.href=d.css;p.crossOrigin="";h.appendChild(p);var c=document.createElement("link");c.rel="stylesheet";c.href=d.css;c.media="print";c.crossOrigin="";c.setAttribute("data-async-style","");h.appendChild(c)}ld(d.preload);rp();if(v(d.entry,".js")){var m=document.createElement("script");m.type="module";m.crossOrigin="";m.src=pol?pol.createScriptURL(d.entry):d.entry;h.appendChild(m)}ld(d.preloadLow,1)}if(document.visibilityState==="hidden"||!window.requestAnimationFrame)go();else{requestAnimationFrame(function(){setTimeout(go,0)});setTimeout(go,1500)}})()';

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

// Google Customer Reviews reads the order-confirmation page (served from
// app.html) and rejects the integration if anything precedes <!DOCTYPE html>.
// Checked on the emitted documents because the shell injection and critical-CSS
// inlining above run after Vite's own HTML transform (tools/doctype.mjs).
function verifyDoctype(ctx, htmlFiles) {
	for (const file of htmlFiles) {
		const problem = doctypeProblem(readFileSync(file, 'utf-8'));
		if (problem) ctx.error(`doctype: ${path.basename(file)} — ${problem}; Google Customer Reviews requires <!DOCTYPE html> as the first bytes`);
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
	const chunks = Object.keys(bundle).filter((f) => bundle[f].type === 'chunk');
	// A page module that is BOTH lazily routed and statically imported elsewhere
	// (ProductDetailPage, rendered by ShopListedProductPage too) still gets its
	// own chunk, but rolldown reports no facadeModuleId for it — so fall back to
	// the dynamic-entry chunk that contains the module.
	const entryFile = chunks.find((f) => bundle[f].facadeModuleId?.endsWith(facadeSuffix))
		?? chunks.find((f) => bundle[f].isDynamicEntry && bundle[f].moduleIds?.some((id) => id.endsWith(facadeSuffix)))
		?? chunks.find((f) => bundle[f].moduleIds?.some((id) => id.endsWith(facadeSuffix)));
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
		.filter((f) => !html.includes(`href="/${f}"`) && !html.includes(`data-css="/${f}"`))
		.map((f) => `<link rel="preload" as="style" fetchpriority="low" crossorigin href="/${f}">`)
		.join('');
	if (cssPreloads) html = html.replace('</head>', `${cssPreloads}</head>`);
	return html;
}

// Routes whose lazy chunk graph app.html preloads up front (see the
// data-route-preload note above CSP_BOOTSTRAP). Keys ending in "/" match any
// deeper path; exact keys match that path only. Values are the facade suffix
// of the route's page module in the bundle. Keep this to the high-traffic
// public entry points: every entry adds its chunk names to app.html.
const ROUTE_PRELOADS = {
	'/marketplace': 'pages/marketplace/MarketplacePage.jsx',
	'/marketplace/': 'pages/ProductDetailPage.jsx',
	'/shop': 'pages/shop/ShopPage.jsx',
	'/events': 'pages/community/CommunityEventsPage.jsx',
	'/collections': 'pages/PublicCollectionsPage.jsx',
	'/collections/': 'pages/collections/CollectionPage.jsx',
	'/blog': 'pages/blog/BlogPage.jsx',
	'/grading': 'pages/grading/GradingPage.jsx',
	'/analytics': 'pages/markets/MarketsPage.jsx',
	'/prices': 'pages/prices/CardPricesHubPage.jsx',
	'/card-shops': 'pages/stores/CardShopsHubPage.jsx',
	'/login': 'pages/LoginPage.jsx',
	'/signup': 'pages/SignupPage.jsx',
};

// Add the data-route-preload map to app.html's bootstrap tag (attribute-only:
// the script text and its CSP hash are untouched). Chunks the document already
// preloads (the entry graph) are left out of every route's list.
function addRoutePreloadMap(html, bundle, warn) {
	const preloadAttr = html.match(/data-preload="([^"]*)"/);
	const entryAttr = html.match(/data-entry="([^"]*)"/);
	if (!preloadAttr) {
		warn('app-shell: data-preload attribute not found — route preload map skipped');
		return html;
	}
	const existing = new Set(preloadAttr[1].split(',').filter(Boolean));
	if (entryAttr) existing.add(entryAttr[1]);
	const entries = [];
	for (const [route, facade] of Object.entries(ROUTE_PRELOADS)) {
		const files = collectRouteChunkFiles(bundle, facade);
		if (!files) {
			warn(`app-shell: ${facade} chunk not found in bundle — no preloads for ${route}`);
			continue;
		}
		const names = files.js
			.filter((f) => f.startsWith('assets/') && f.endsWith('.js') && !existing.has(`/${f}`))
			.map((f) => f.slice('assets/'.length, -'.js'.length))
			.filter((n) => /^[\w-]+$/.test(n));
		if (names.length > 0) entries.push(`${route}:${names.join(',')}`);
	}
	if (entries.length === 0) return html;
	return html.replace(preloadAttr[0], `${preloadAttr[0]} data-route-preload="${entries.join(';')}"`);
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

// Inline the above-the-fold critical CSS for the shell markup in `html` and
// load the full stylesheet asynchronously so it no longer blocks the shell's
// first paint. The classic media="print"/onload swap uses an inline handler
// that our hardened CSP (no 'unsafe-inline' in script-src) blocks, so we strip
// beasties' onload and let main.jsx flip [data-async-style] to media "all"
// instead. Fail-safe: any error keeps the render-blocking link.
//
// Used for BOTH documents. The critical CSS is computed per document from its
// own shell (the hero for index.html, the header + route loader for app.html),
// so each inlines only what its first paint needs.
async function inlineCriticalCss(html, outDir, label, warn) {
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
		const processed = await beasties.process(html);
		html = processed.replace(/ onload="this\.media='all'"/g, ' data-async-style');

		// Hand the deferred (media="print") stylesheet to the CSP bootstrap
		// (data-css) instead of leaving it as a parser-inserted tag. The
		// bootstrap injects it one frame after the first paint, together
		// with an as="style" preload: a bare print stylesheet is fetched at
		// the browser's LOWEST priority and loses the bandwidth race against
		// the JS chunks (main.jsx gates the React mount on it, 2s fail-safe),
		// while a parser-inserted preload is VeryHigh priority — which
		// Lighthouse's simulation counts as render-blocking for the shell's
		// paint even though media="print" never blocks anything. Injecting
		// both post-paint gets the high fetch priority without the simulated
		// penalty. Only the first (main) stylesheet is handed over; any other
		// deferred sheet keeps its tag.
		let deferredCss = null;
		html = html.replace(
			/<link rel="stylesheet"([^>]*?) media="print" data-async-style>/,
			(tag, attrs) => {
				const href = attrs.match(/href="([^"]+)"/)?.[1];
				if (!href || !/^\/assets\/[^"]+\.css$/.test(href)) return tag;
				deferredCss = href;
				return '';
			},
		);
		if (deferredCss) {
			const bootstrapTag = html.match(/<script data-entry="[^"]*" data-preload="[^"]*"/);
			if (bootstrapTag) {
				html = html.replace(bootstrapTag[0], `${bootstrapTag[0]} data-css="${deferredCss}"`);
			} else {
				warn(`${label}: bootstrap tag not found — deferred stylesheet restored as a plain link`);
				html = html.replace('</head>', `<link rel="stylesheet" crossorigin href="${deferredCss}" media="print" data-async-style></head>`);
			}
		}
	} catch (e) {
		warn(`${label}: critical-CSS inlining skipped (${e.message}); CSS stays render-blocking`);
	}

	// Beasties drops the local()-only 'Syne Fallback' face from the inlined
	// critical CSS — put it back so the shell's text paints with the oversized
	// metric-adjusted fallback (see SYNE_FALLBACK_FONT_FACE above).
	if (html.includes('<style>')) {
		html = html.replace('<style>', `<style>${SYNE_FALLBACK_FONT_FACE}`);
	} else {
		warn(`${label}: no inline <style> found — Syne Fallback face not injected`);
	}
	return html;
}

function homeShellPlugin() {
	// Coming-soon builds redirect "/" to /launch on mount, so the static shell
	// and the preloaded route graph must both be the LAUNCH page's — otherwise
	// the LCP paints homepage content that's immediately replaced, and ~25
	// homepage chunks download only to be thrown away (VITE_COMING_SOON is a
	// build-time env var, same as its use in App.jsx).
	const comingSoon = process.env.VITE_COMING_SOON === 'true';
	const homeShellPath = path.resolve(__dirname, 'tools/home-shell.html');
	const shellPath = comingSoon ? path.resolve(__dirname, 'tools/launch-shell.html') : homeShellPath;
	const routeFacade = comingSoon ? 'pages/LaunchPage.jsx' : 'pages/HomePage.jsx';
	return {
		name: 'cardpop-home-shell',
		apply: 'build',
		async writeBundle(outputOptions, bundle) {
			const outDir = outputOptions.dir || path.resolve(__dirname, 'dist');
			const indexPath = path.join(outDir, 'index.html');
			const appPath = path.join(outDir, 'app.html');
			if (!existsSync(indexPath)) return;
			const warn = (m) => this.warn(m);

			const builtIndex = applyCspBootstrap(readFileSync(indexPath, 'utf-8'), warn);

			// Content routes (marketplace, shop, product, category…) render an
			// above-the-fold card image from the image CDN as their LCP element, so
			// warming that origin's DNS/TCP/TLS ahead of the image request shaves
			// meaningful time off mobile LCP. The homepage gets the same preconnect:
			// its LCP is text, but its longest network chain ends in the "Just
			// Listed" card photos from that origin, and Lighthouse's
			// network-dependency-tree insight flags exactly that unwarmed origin.
			// Gated on VITE_IMAGE_CDN_HOST (a real build-time env var on Vercel) so
			// there's never a wasted preconnect when the CDN is disabled — images
			// then come from Supabase, which is already preconnected.
			const baseHtml = injectImageCdnPreconnect(builtIndex, warn);

			const marker = '<div id="root"></div>';
			if (!baseHtml.includes(marker)) {
				this.warn('home-shell: `<div id="root"></div>` not found — shells not injected');
				writeFileSync(appPath, baseHtml, 'utf-8');
				verifyCspBootstrap(this, [indexPath, appPath]);
			verifyDoctype(this, [indexPath, appPath]);
				return;
			}

			// app.html — every route but "/": the shared chrome (announcement bar,
			// header, cookie banner) plus the route loader, from the same source
			// file as the homepage shell so the header can't drift between them.
			let appHtml = baseHtml.replace(marker, `<div id="root">${appShellFromHomeShell(readFileSync(homeShellPath, 'utf-8'))}</div>`);
			appHtml = await inlineCriticalCss(appHtml, outDir, 'app-shell', warn);
			appHtml = addRoutePreloadMap(appHtml, bundle, warn);
			writeFileSync(appPath, appHtml, 'utf-8');

			// index.html — the "/"-only document with the hero shell.
			let indexHtml = baseHtml.replace(marker, `<div id="root">${readFileSync(shellPath, 'utf-8')}</div>`);
			indexHtml = await inlineCriticalCss(indexHtml, outDir, 'home-shell', warn);

			// Preload the "/" route's lazy chunk graph in parallel with the
			// critical path (see collectRouteChunkFiles above).
			indexHtml = addHomeRoutePreloads(indexHtml, bundle, warn, routeFacade);

			writeFileSync(indexPath, indexHtml, 'utf-8');
			verifyCspBootstrap(this, [indexPath, appPath]);
			verifyDoctype(this, [indexPath, appPath]);
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
