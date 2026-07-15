#!/usr/bin/env node

// Generates public/llms.txt — the entry point AI agents and LLMs read to
// understand CardPop (see https://llmstxt.org). It is a curated map of the
// PUBLIC, agent-relevant surface of the site: an H1 title, a blockquote
// summary, then H2 sections of markdown links with absolute URLs and short
// descriptions.
//
// This is intentionally hand-curated rather than scraped from the React
// routes. Auto-scraping Helmet titles produced a flat, mostly-useless dump
// (admin/account pages, "No description available" filler) that hurt more than
// it helped. Every URL below is a real, public route in App.jsx — keep this
// file in sync when public sections are added or renamed.

import fs from 'fs';
import path from 'path';

const SITE_ORIGIN = 'https://cardpop.com.au';
const SITE_NAME = 'CardPop';
const SITE_SUMMARY = "Australia's trading card marketplace for Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards. Buy, sell, and trade authenticated cards with live AUD pricing and buyer protection.";

// Ordered sections. Each entry: [path, title, description]. Paths are
// site-relative and resolved against SITE_ORIGIN.
const SECTIONS = [
	['Marketplace & Shop', [
		['/marketplace', 'Marketplace', 'Browse and buy trading cards listed by Australian sellers, with buyer protection.'],
		['/shop', 'CardPop Shop', 'The official CardPop shop — sealed product and singles sold directly.'],
		['/shop/singles', 'Shop — Singles', 'Individual single cards available to buy now.'],
		['/shop/sealed-boxes', 'Shop — Sealed Boxes', 'Sealed booster boxes and cases.'],
		['/collections', 'Collections', 'Curated collections grouping cards by set, franchise and theme.'],
	]],
	['Prices & Market Data', [
		['/prices', 'Card Prices', 'Live AUD market pricing for trading cards, sourced from recent sales.'],
		['/markets', 'Markets', 'Market trends and movements across trading card categories.'],
		['/australian-markets', 'Australian Markets', 'Pricing and demand data specific to the Australian market.'],
		['/analytics', 'Analytics', 'Aggregate analytics and reporting across the marketplace.'],
	]],
	['Grading', [
		['/grading', 'Grading', 'Everything about card grading — how it works and who does it.'],
		['/grading/what-is-grading', 'What Is Grading?', 'An introduction to trading card grading.'],
		['/grading/scales', 'Grading Scales', 'How the major grading scales (PSA, Beckett and others) compare.'],
		['/grading/companies', 'Grading Companies', 'Directory of grading companies and their services.'],
		['/grading/local-graders', 'Local Graders', 'Grading services available within Australia.'],
		['/grading/submission-partners', 'Submission Partners', 'Partners that handle grading submissions on your behalf.'],
		['/grading/estimator', 'Grade Estimator', 'Estimate the likely grade of a card before submitting it.'],
		['/grading/roi-calculator', 'Grading ROI Calculator', 'Estimate the return on investment of grading a card.'],
	]],
	['Community & Events', [
		['/community', 'Community', 'The CardPop community hub — forums, traders and local groups.'],
		['/community/forum', 'Community Forum', 'Discussion forum for collectors and traders.'],
		['/community/local-traders', 'Local Traders', 'Find traders near you across Australia.'],
		['/community/retailers', 'Retailers', 'Directory of trading card retailers.'],
		['/community/whatnot', 'Whatnot Sellers', 'Australian card sellers streaming on Whatnot.'],
		['/events', 'Events', 'Card shows, community events, store events and trade events.'],
		['/card-shops', 'Card Shops Directory', 'Directory of trading card shops across Australia.'],
	]],
	['Guides & Blog', [
		['/blog', 'Blog', 'Articles, guides and news about trading cards and collecting.'],
		['/photography-guide', 'Photography Guide', 'How to photograph cards well for listings.'],
	]],
	['Company & Policies', [
		['/about', 'About CardPop', 'What CardPop is and who is behind it.'],
		['/contact', 'Contact', 'How to get in touch with CardPop.'],
		['/faq', 'FAQ', 'Answers to common questions about buying, selling and grading.'],
		['/trust-safety', 'Trust & Safety', 'How CardPop protects buyers and sellers.'],
		['/returns', 'Returns', 'The returns policy for purchases.'],
		['/shipping', 'Shipping', 'Shipping options, timings and costs.'],
		['/privacy-policy', 'Privacy Policy', 'How CardPop handles personal data.'],
		['/terms', 'Terms of Service', 'The terms governing use of CardPop.'],
		['/accessibility', 'Accessibility', 'CardPop\'s accessibility commitments.'],
	]],
];

function toAbsolute(url) {
	if (!url) return SITE_ORIGIN;
	if (/^https?:\/\//.test(url)) return url;
	return `${SITE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function generateLlmsTxt() {
	const lines = [`# ${SITE_NAME}`, '', `> ${SITE_SUMMARY}`, ''];

	for (const [heading, entries] of SECTIONS) {
		lines.push(`## ${heading}`);
		for (const [url, title, description] of entries) {
			lines.push(`- [${title}](${toAbsolute(url)}): ${description}`);
		}
		lines.push('');
	}

	lines.push('## Machine-readable resources');
	lines.push(`- [API catalog](${SITE_ORIGIN}/.well-known/api-catalog): RFC 9727 linkset describing the public API.`);
	lines.push(`- [OpenAPI description](${SITE_ORIGIN}/openapi.json): OpenAPI 3.1 description of the public API.`);
	lines.push(`- [Agent skills index](${SITE_ORIGIN}/.well-known/agent-skills/index.json): Discoverable SKILL.md docs for AI agents (Agent Skills Discovery RFC).`);
	lines.push(`- [Sitemap](${SITE_ORIGIN}/sitemap.xml): XML sitemap of indexable pages.`);
	lines.push(`- [Security policy](${SITE_ORIGIN}/.well-known/security.txt): How to report security issues (RFC 9116).`);
	lines.push('');

	return lines.join('\n');
}

function main() {
	const outputPath = path.join(process.cwd(), 'public', 'llms.txt');
	const dir = path.dirname(outputPath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(outputPath, generateLlmsTxt(), 'utf8');
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
	main();
}

export { generateLlmsTxt };
