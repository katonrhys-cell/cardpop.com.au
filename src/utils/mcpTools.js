// Read-only tool definitions for the CardPop MCP server (src/routes/mcp.js).
//
// Each tool is { name, description, inputSchema, execute }. `execute` returns an
// MCP tool result — { content: [{ type: 'text', text }], isError? }. Tools take
// the Supabase client as a dependency so they can be unit-tested with a mock.
//
// SECURITY: the injected client is the backend service-role client, which
// BYPASSES row-level security. Every query here therefore filters to
// publicly-visible rows explicitly (active listings, published price
// snapshots) — never rely on RLS for what these expose. Everything is
// read-only: no insert/update/delete, no auth-gated data.

const SITE_ORIGIN = 'https://cardpop.com.au';

const SITE_SUMMARY =
	"CardPop is Australia's trading card marketplace for Pokémon, Magic: The Gathering, Yu-Gi-Oh and sports cards. Buy, sell, and trade authenticated cards with live AUD pricing and buyer protection.";

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
};

function text(message) {
	return { content: [{ type: 'text', text: message }] };
}

function json(value) {
	return text(JSON.stringify(value, null, 2));
}

// Escape LIKE wildcards so user input can't turn into a broad pattern.
function likeArg(value, max = 100) {
	return String(value ?? '')
		.slice(0, max)
		.replace(/[%_\\]/g, (m) => `\\${m}`)
		.trim();
}

// Strip everything except letters/numbers/space/hyphen. Used where the term is
// interpolated into a PostgREST `.or()` string, whose commas/parens are
// syntax — this keeps the term from breaking (or injecting into) that filter.
function orSafe(value, max = 80) {
	return String(value ?? '')
		.normalize('NFKC')
		.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

function toOne(embed) {
	return Array.isArray(embed) ? embed[0] : embed;
}

function clampLimit(limit, fallback, max) {
	const n = Number.parseInt(limit, 10);
	if (Number.isNaN(n)) return fallback;
	return Math.min(Math.max(1, n), max);
}

export function buildTools(supabase) {
	return [
		{
			name: 'search_cards',
			description:
				'Search the CardPop marketplace for active (buyable) trading card listings by card name or keyword. Returns matching listings with their price in AUD, seller, and a link. Read-only.',
			inputSchema: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'Card name or keyword, e.g. "Charizard" or "Blue-Eyes White Dragon".',
					},
					limit: {
						type: 'integer',
						description: 'Maximum results to return (1–20, default 5).',
						minimum: 1,
						maximum: 20,
					},
				},
				required: ['query'],
				additionalProperties: false,
			},
			async execute(args = {}) {
				const q = likeArg(args.query);
				if (!q) return text('Please provide a non-empty search query.');
				const limit = clampLimit(args.limit, 5, 20);

				const { data, error } = await supabase
					.from('listings')
					.select(
						'id, price_aud, status, listing_type, vault_item:vault_items!inner(card_name), seller:profiles!seller_id(username, display_name)'
					)
					.eq('status', 'active')
					.neq('listing_type', 'vault')
					.ilike('vault_item.card_name', `%${q}%`)
					.order('price_aud', { ascending: true })
					.limit(limit);

				if (error) throw new Error(error.message);

				const results = (data || []).map((row) => {
					const item = toOne(row.vault_item) || {};
					const seller = toOne(row.seller) || {};
					return {
						card_name: item.card_name || null,
						price_aud: row.price_aud ?? null,
						seller: seller.display_name || seller.username || null,
						url: `${SITE_ORIGIN}/marketplace/${row.id}`,
					};
				});

				return json({
					query: args.query,
					count: results.length,
					currency: 'AUD',
					results,
				});
			},
		},
		{
			name: 'get_card_price',
			description:
				'Look up the latest CardPop market price (in AUD) for a tracked trading card by name. Returns recent-sales averages/ranges for raw and graded copies. Read-only.',
			inputSchema: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'Card name to price, e.g. "Base Set Charizard".',
					},
				},
				required: ['query'],
				additionalProperties: false,
			},
			async execute(args = {}) {
				const q = orSafe(args.query);
				if (!q) return text('Please provide a non-empty card name.');

				const { data: cards, error: cardErr } = await supabase
					.from('tracked_cards')
					.select('id, slug, name, set_name, category')
					.or(`name.ilike.%${q}%,search_query.ilike.%${q}%`)
					.limit(1);

				if (cardErr) throw new Error(cardErr.message);
				const card = (cards || [])[0];
				if (!card) {
					return text(`No tracked card found matching "${args.query}". Try the marketplace search instead.`);
				}

				const { data: snap, error: snapErr } = await supabase
					.from('card_price_snapshots')
					.select(
						'snapshot_date, raw_avg, raw_min, raw_max, raw_count, graded_avg, graded_min, graded_max, graded_count'
					)
					.eq('card_id', card.id)
					.order('snapshot_date', { ascending: false })
					.limit(1)
					.maybeSingle();

				if (snapErr) throw new Error(snapErr.message);

				return json({
					card: {
						name: card.name,
						set: card.set_name || null,
						category: card.category || null,
						url: `${SITE_ORIGIN}/prices/${card.slug}`,
					},
					currency: 'AUD',
					price: snap
						? {
								as_of: snap.snapshot_date,
								raw: { avg: snap.raw_avg, min: snap.raw_min, max: snap.raw_max, sample_size: snap.raw_count },
								graded: {
									avg: snap.graded_avg,
									min: snap.graded_min,
									max: snap.graded_max,
									sample_size: snap.graded_count,
								},
							}
						: null,
					note: snap ? 'Indicative, from recent observed sales.' : 'This card is tracked but has no price snapshot yet.',
				});
			},
		},
		{
			name: 'get_site_overview',
			description:
				'Get a short overview of CardPop and the list of public sections available. Call this first to orient. Read-only, no arguments.',
			inputSchema: { type: 'object', properties: {}, additionalProperties: false },
			async execute() {
				return json({
					name: 'CardPop',
					url: SITE_ORIGIN,
					summary: SITE_SUMMARY,
					sections: Object.entries(SECTIONS).map(([section, path]) => ({
						section,
						url: `${SITE_ORIGIN}${path}`,
					})),
				});
			},
		},
	];
}
