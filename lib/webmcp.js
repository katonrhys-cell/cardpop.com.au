// WebMCP — expose a small set of safe, read-only site actions to in-browser AI
// agents via the experimental Web Model Context Protocol
// (https://webmachinelearning.github.io/webmcp/). When a WebMCP-capable agent
// is driving the browser it can discover and call these tools instead of
// guessing at the DOM.
//
// Scope is deliberately conservative: every tool is read-only and same-origin.
// Nothing here mutates data, touches authenticated endpoints, or makes external
// requests — the tools only run the in-app search and navigate between public
// sections, which an agent could already do by clicking. That keeps the surface
// safe to expose to any agent without a permission model.
//
// The whole thing is a no-op in browsers without `navigator.modelContext`
// (i.e. almost all of them today), so it is safe to install unconditionally at
// startup.

// The public sections an agent may be pointed at. Kept in sync with the curated
// list in tools/generate-llms.js and public/llms.txt. Keys are the `section`
// enum values exposed to the tool; values are the site-relative paths.
const SECTIONS = {
	marketplace: '/marketplace',
	shop: '/shop',
	prices: '/prices',
	collections: '/collections',
	grading: '/grading',
	community: '/community',
	events: '/events',
	'card-shops': '/card-shops',
	blog: '/blog',
	about: '/about',
	faq: '/faq',
	contact: '/contact',
};

const SITE_SUMMARY =
	"CardPop is Australia's trading card marketplace for Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards. Buy, sell, and trade authenticated cards with live AUD pricing and buyer protection.";

// Client-side navigation that works with react-router's BrowserRouter without a
// full page reload, so registered tools survive the navigation. pushState
// updates the URL; the dispatched popstate wakes react-router's history
// listener, which re-reads window.location and renders the new route.
function navigate(path) {
	window.history.pushState({}, '', path);
	window.dispatchEvent(new PopStateEvent('popstate'));
}

function text(message) {
	return { content: [{ type: 'text', text: message }] };
}

function buildTools() {
	return [
		{
			name: 'search_cards',
			description:
				'Search the CardPop marketplace for trading cards by name, set, or keyword (e.g. "Charizard", "Blue-Eyes White Dragon"). Navigates to the marketplace results for the query.',
			inputSchema: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'The card name or keyword to search for.',
					},
				},
				required: ['query'],
				additionalProperties: false,
			},
			execute: ({ query } = {}) => {
				const q = String(query ?? '').trim();
				if (!q) {
					return text('Please provide a non-empty search query.');
				}
				const url = `/marketplace?q=${encodeURIComponent(q)}`;
				navigate(url);
				return text(
					`Showing CardPop marketplace results for "${q}" at https://cardpop.com.au${url}`
				);
			},
		},
		{
			name: 'browse_section',
			description:
				'Open one of CardPop’s main public sections. Use this to move the user to a known area of the site.',
			inputSchema: {
				type: 'object',
				properties: {
					section: {
						type: 'string',
						enum: Object.keys(SECTIONS),
						description: 'Which section to open.',
					},
				},
				required: ['section'],
				additionalProperties: false,
			},
			execute: ({ section } = {}) => {
				const path = SECTIONS[section];
				if (!path) {
					return text(
						`Unknown section "${section}". Available sections: ${Object.keys(SECTIONS).join(', ')}.`
					);
				}
				navigate(path);
				return text(`Opened the ${section} section at https://cardpop.com.au${path}`);
			},
		},
		{
			name: 'get_site_overview',
			description:
				'Get a short overview of CardPop and the list of public sections available for navigation. Call this first to orient before using other tools.',
			inputSchema: {
				type: 'object',
				properties: {},
				additionalProperties: false,
			},
			execute: () =>
				text(
					JSON.stringify(
						{
							name: 'CardPop',
							url: 'https://cardpop.com.au',
							summary: SITE_SUMMARY,
							sections: Object.entries(SECTIONS).map(([key, path]) => ({
								section: key,
								url: `https://cardpop.com.au${path}`,
							})),
						},
						null,
						2
					)
				),
		},
	];
}

// Install the tools. Prefers the declarative provideContext() (replaces the
// full tool set in one call); falls back to registerTool() for builds of the
// API that only expose the imperative form.
export function installWebMcp() {
	if (typeof navigator === 'undefined') return;
	const ctx = navigator.modelContext;
	if (!ctx) return;

	const tools = buildTools();

	try {
		if (typeof ctx.provideContext === 'function') {
			ctx.provideContext({ tools });
		} else if (typeof ctx.registerTool === 'function') {
			for (const tool of tools) ctx.registerTool(tool);
		}
	} catch {
		// The API is experimental and its shape is still moving; never let a
		// registration failure break app startup.
	}
}
