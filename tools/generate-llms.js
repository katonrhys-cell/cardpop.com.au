#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const CLEAN_CONTENT_REGEX = {
	comments: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
	templateLiterals: /`[\s\S]*?`/g,
	// Bounded to one line: real string literals can't span raw newlines, and an
	// apostrophe in JSX text (e.g. "you'll") must not swallow the lines below it.
	strings: /'[^'\n]*'|"[^"\n]*"/g,
	jsxExpressions: /\{.*?\}/g,
	htmlEntities: {
		quot: /&quot;/g,
		amp: /&amp;/g,
		lt: /&lt;/g,
		gt: /&gt;/g,
		apos: /&apos;/g
	}
};

const EXTRACTION_REGEX = {
	route: /<Route\s+[^>]*>/g,
	path: /path=["']([^"']+)["']/,
	element: /element=\{<(\w+)[^}]*\/?\s*>\}/,
	helmet: /<Helmet[^>]*?>([\s\S]*?)<\/Helmet>/i,
	helmetTest: /<Helmet[\s\S]*?<\/Helmet>/i,
	title: /<title[^>]*?>\s*(.*?)\s*<\/title>/i,
	description: /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
};

function cleanContent(content) {
	return content
		.replace(CLEAN_CONTENT_REGEX.comments, '')
		.replace(CLEAN_CONTENT_REGEX.templateLiterals, '""')
		.replace(CLEAN_CONTENT_REGEX.strings, '""');
}

function cleanText(text) {
	if (!text) return text;

	return text
		.replace(CLEAN_CONTENT_REGEX.jsxExpressions, '')
		.replace(CLEAN_CONTENT_REGEX.htmlEntities.quot, '"')
		.replace(CLEAN_CONTENT_REGEX.htmlEntities.amp, '&')
		.replace(CLEAN_CONTENT_REGEX.htmlEntities.lt, '<')
		.replace(CLEAN_CONTENT_REGEX.htmlEntities.gt, '>')
		.replace(CLEAN_CONTENT_REGEX.htmlEntities.apos, "'")
		// Strip leftover JSX/template-literal punctuation (e.g. `{` `}` backticks)
		// and any leading separator so titles read cleanly.
		.replace(/[`{}]/g, '')
		.replace(/^[\s\-|–—]+/, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function extractRoutes(appJsxPath) {
	if (!fs.existsSync(appJsxPath)) return new Map();

	try {
		const content = fs.readFileSync(appJsxPath, 'utf8');
		const routes = new Map();
		const routeMatches = [...content.matchAll(EXTRACTION_REGEX.route)];

		for (const match of routeMatches) {
			const routeTag = match[0];
			const pathMatch = routeTag.match(EXTRACTION_REGEX.path);
			const elementMatch = routeTag.match(EXTRACTION_REGEX.element);
			const isIndex = routeTag.includes('index');

			if (elementMatch) {
				const componentName = elementMatch[1];
				let routePath;

				if (isIndex) {
					routePath = '/';
				} else if (pathMatch) {
					routePath = pathMatch[1].startsWith('/') ? pathMatch[1] : `/${pathMatch[1]}`;
				}

				routes.set(componentName, routePath);
			}
		}

		return routes;
	} catch (error) {
		return new Map();
	}
}

function findReactFiles(dir) {
	const results = [];
	for (const item of fs.readdirSync(dir)) {
		const full = path.join(dir, item);
		if (fs.statSync(full).isDirectory()) {
			results.push(...findReactFiles(full));
		} else if (/\.(jsx|js)$/.test(item)) {
			results.push(full);
		}
	}
	return results;
}

function extractHelmetData(content, filePath, routes) {
	const cleanedContent = cleanContent(content);

	if (!EXTRACTION_REGEX.helmetTest.test(cleanedContent)) {
		return null;
	}

	const helmetMatch = content.match(EXTRACTION_REGEX.helmet);
	if (!helmetMatch) return null;

	const helmetContent = helmetMatch[1];
	const titleMatch = helmetContent.match(EXTRACTION_REGEX.title);
	const descMatch = helmetContent.match(EXTRACTION_REGEX.description);

	const title = cleanText(titleMatch?.[1]);
	const description = cleanText(descMatch?.[1]);

	const fileName = path.basename(filePath, path.extname(filePath));
	// routes is a Map — use .size (the previous `.length` was always undefined,
	// so every page fell back to a guessed slug instead of its real route).
	const url = routes.size && routes.has(fileName)
		? routes.get(fileName)
		: generateFallbackUrl(fileName);

	return {
		url,
		title: title || 'Untitled Page',
		description: description || 'No description available'
	};
}

function generateFallbackUrl(fileName) {
	const cleanName = fileName.replace(/Page$/, '').toLowerCase();
	return cleanName === 'app' ? '/' : `/${cleanName}`;
}

const SITE_ORIGIN = 'https://cardpop.com.au';
const SITE_NAME = 'CardPop';
const SITE_SUMMARY = "Australia's trading card marketplace for Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards. Buy, sell, and trade authenticated cards with live AUD pricing and buyer protection.";

function toAbsolute(url) {
	if (!url) return SITE_ORIGIN;
	if (/^https?:\/\//.test(url)) return url;
	return `${SITE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Follows the llms.txt spec (https://llmstxt.org): an H1 site title, a
// blockquote summary, then H2 sections of markdown links with absolute URLs.
function generateLlmsTxt(pages) {
	const sortedPages = pages.sort((a, b) => a.title.localeCompare(b.title));
	const pageEntries = sortedPages.map(page =>
		`- [${page.title}](${toAbsolute(page.url)}): ${page.description}`
	).join('\n');

	return [
		`# ${SITE_NAME}`,
		'',
		`> ${SITE_SUMMARY}`,
		'',
		'## Pages',
		pageEntries,
		'',
	].join('\n');
}

function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function processPageFile(filePath, routes) {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		return extractHelmetData(content, filePath, routes);
	} catch (error) {
		console.error(`❌ Error processing ${filePath}:`, error.message);
		return null;
	}
}

function main() {
	const pagesDir = path.join(process.cwd(), 'pages');
	const appJsxPath = path.join(process.cwd(), 'App.jsx');

	let pages = [];

	if (!fs.existsSync(pagesDir)) {
		pages.push(processPageFile(appJsxPath, []))
		pages = pages.filter(Boolean);
	} else {
		const routes = extractRoutes(appJsxPath);
		const reactFiles = findReactFiles(pagesDir);

		pages = reactFiles
			.map(filePath => processPageFile(filePath, routes))
			.filter(Boolean);
	}

	if (pages.length === 0) {
		console.error('❌ No pages with Helmet components found!');
		process.exit(1);
	}


	const llmsTxtContent = generateLlmsTxt(pages);
	const outputPath = path.join(process.cwd(), 'public', 'llms.txt');

	ensureDirectoryExists(path.dirname(outputPath));
	fs.writeFileSync(outputPath, llmsTxtContent, 'utf8');
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
	main();
}
