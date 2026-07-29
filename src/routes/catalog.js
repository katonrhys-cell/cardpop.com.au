import { Router } from 'express';
import { callEbayApi } from '../utils/ebayClient.js';
import { resolveCardImage } from '../utils/cardImageResolver.js';
import { leadingCardNumber } from '../../utils/cardNumber.js';
import logger from '../utils/logger.js';

const router = Router();

const FETCH_TIMEOUT_MS = 8000;

// ── Free API adapters ─────────────────────────────────────────────────────────
//
// Each adapter takes an optional `number` (the collector number without its
// "/total" suffix). Searching on the name alone returns an arbitrary handful of
// a card's many printings — for a common name the right one usually isn't among
// them — so when the number was read off the card it is pushed down into the
// upstream query rather than used only to score whatever came back.

async function searchPokemon(q, take, { number } = {}) {
	const terms = [`name:"${q}*"`];
	if (number) terms.push(`number:"${number}"`);
	const encoded = encodeURIComponent(terms.join(' '));
	const url = `https://api.pokemontcg.io/v2/cards?q=${encoded}&pageSize=${Math.min(take, 20)}&select=id,name,set,number,rarity,images`;
	const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) return [];
	const { data } = await res.json();
	return (data ?? []).map(c => ({
		id: c.id,
		name: c.name,
		setName: c.set?.name ?? null,
		year: c.set?.releaseDate ? parseInt(c.set.releaseDate.slice(0, 4), 10) : null,
		cardNumber: c.number ?? null,
		rarity: c.rarity ?? null,
		imageUrl: c.images?.small ?? null,
		source: 'pokemon-tcg',
	}));
}

async function searchScryfall(q, take, { number } = {}) {
	// `cn:` is Scryfall's collector-number filter. Scryfall answers 404 (not an
	// empty list) when nothing matches, which the !res.ok guard turns into [] —
	// that is what drives the caller's fall back to the broader name-only pass.
	const query = number ? `${q} cn:${number}` : q;
	const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name&unique=cards`;
	const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) return [];
	const { data } = await res.json();
	return (data ?? []).slice(0, take).map(c => ({
		id: c.id,
		name: c.name,
		setName: c.set_name ?? null,
		year: c.released_at ? parseInt(c.released_at.slice(0, 4), 10) : null,
		cardNumber: c.collector_number ?? null,
		rarity: c.rarity ?? null,
		imageUrl: c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? null,
		source: 'scryfall',
	}));
}

async function searchYugioh(q, take) {
	const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(q)}&num=${Math.min(take, 20)}&offset=0`;
	const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) return [];
	const { data } = await res.json();
	return (data ?? []).map(c => ({
		id: String(c.id),
		name: c.name,
		setName: null,
		year: null,
		cardNumber: null,
		rarity: null,
		imageUrl: c.card_images?.[0]?.image_url_small ?? null,
		source: 'yugioh-api',
	}));
}

function resolveApis(collection) {
	const col = (collection || '').toLowerCase();
	if (col === 'pokemon') return ['pokemon'];
	if (col === 'magic' || col === 'magic: the gathering' || col === 'mtg') return ['scryfall'];
	if (col === 'yu-gi-oh' || col === 'yugioh') return ['yugioh'];
	// No collection specified — try all three
	return ['pokemon', 'scryfall', 'yugioh'];
}

async function runSearches(apis, q, take, opts = {}) {
	const tasks = apis.map(api => {
		if (api === 'pokemon') return searchPokemon(q, take, opts).catch(() => []);
		if (api === 'scryfall') return searchScryfall(q, take, opts).catch(() => []);
		// YGOPRODeck has no collector-number filter, so it always runs name-only.
		if (api === 'yugioh')   return searchYugioh(q, take).catch(() => []);
		return Promise.resolve([]);
	});
	const results = await Promise.all(tasks);
	return results.flat();
}

// ── GET /catalog/search ───────────────────────────────────────────────────────
// Query params: q (required), collection (optional), segment (alias),
//               number (optional collector number), take (default 10)
//
// When a collector number is supplied the search runs in two passes: a precise
// one filtered on that number, then — only if it found nothing — the broad
// name-only pass. The fallback matters because a number can be misread, or the
// upstream can store it in a form the filter doesn't reach; degrading to
// today's behaviour is better than returning nothing.
router.get('/search', async (req, res) => {
	const { q, collection, segment, take = '10', number } = req.query;
	if (!q?.trim()) return res.status(400).json({ error: 'q is required' });

	const limit = Math.min(parseInt(take, 10) || 10, 50);
	const col = collection || segment || '';
	const cardNumber = leadingCardNumber(number);

	try {
		const apis = resolveApis(col);

		let raw = cardNumber ? await runSearches(apis, q.trim(), limit, { number: cardNumber }) : [];
		const precise = raw.length > 0;
		if (!raw.length) raw = await runSearches(apis, q.trim(), limit);

		// Deduplicate by source+id, cap at limit
		const seen = new Set();
		const results = raw.filter(r => {
			const key = `${r.source}:${r.id}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		}).slice(0, limit);

		// `precise` tells the caller the collector number was applied upstream,
		// not just used to score the results afterwards.
		res.json({ results, precise });
	} catch (err) {
		logger.warn(`[CATALOG_SEARCH] ${err.message}`);
		res.status(502).json({ error: 'Catalog search failed' });
	}
});

// ── GET /catalog/autocomplete ─────────────────────────────────────────────────
// Lightweight typeahead: name + set only, no images.
router.get('/autocomplete', async (req, res) => {
	const { q, collection, take = '5' } = req.query;
	if (!q?.trim() || q.trim().length < 2) return res.json({ results: [] });

	const limit = Math.min(parseInt(take, 10) || 5, 20);
	const col = collection || '';

	try {
		const apis = resolveApis(col);
		const raw = await runSearches(apis, q.trim(), limit);

		const seen = new Set();
		const results = raw
			.filter(r => {
				const key = `${r.source}:${r.id}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.slice(0, limit)
			.map(({ id, name, setName, cardNumber, source }) => ({ id, name, setName, cardNumber, source }));

		res.json({ results });
	} catch (err) {
		logger.warn(`[CATALOG_AUTOCOMPLETE] ${err.message}`);
		res.json({ results: [] });
	}
});

// ── GET /catalog/pricing ──────────────────────────────────────────────────────
// eBay-backed pricing by card name. Returns a CardSight-compatible envelope so
// callers don't need separate field mapping.
// Query params: name (required), set (optional), grading_service, grade
router.get('/pricing', async (req, res) => {
	const { name, set, grading_service, grade } = req.query;
	if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

	const parts = [name.trim()];
	if (set?.trim()) parts.push(set.trim());
	if (grading_service && grading_service !== 'None' && grading_service !== 'raw') {
		parts.push(grading_service.trim());
		if (grade) parts.push(String(grade).trim());
	}
	const query = parts.join(' ');

	try {
		const params = new URLSearchParams({
			q: query,
			filter: 'buyingOptions:{AUCTION|FIXED_PRICE},itemLocationCountry:AU',
			limit: 15,
			sort: 'newlyListed',
		});

		const data = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`);
		const prices = (data.itemSummaries ?? [])
			.map(i => parseFloat(i.price?.value || 0))
			.filter(p => p > 0);

		if (!prices.length) {
			return res.json({
				avgPrice: null,  avg_price: null,
				minPrice: null,  min_price: null,
				maxPrice: null,  max_price: null,
				count: 0, salesCount: 0,
				lastSalePrice: null, last_sale_price: null,
				lastSaleDate: null,  last_sale_date: null,
				currency: 'AUD', source: 'ebay_au',
			});
		}

		const round2 = n => Math.round(n * 100) / 100;
		const avg = round2(prices.reduce((a, b) => a + b, 0) / prices.length);
		const min = round2(Math.min(...prices));
		const max = round2(Math.max(...prices));

		res.json({
			avgPrice: avg,   avg_price: avg,
			minPrice: min,   min_price: min,
			maxPrice: max,   max_price: max,
			count: prices.length,
			salesCount: prices.length,
			lastSalePrice: null, last_sale_price: null,
			lastSaleDate: null,  last_sale_date: null,
			currency: 'AUD',
			source: 'ebay_au',
		});
	} catch (err) {
		logger.warn(`[CATALOG_PRICING] ${err.message}`);
		res.status(502).json({ error: 'Pricing lookup failed' });
	}
});

// ── POST /catalog/images ───────────────────────────────────────────────────────
// Batch-resolve official card art for a list of cards. One request resolves a
// whole table's worth of thumbnails; each card is looked up once and cached
// server-side (and shared across all visitors), so the browser only ever loads a
// ready image URL from the upstream API's CDN — no per-visitor rate-limit
// exposure and no Supabase egress.
//
// Body: { cards: [{ name, set?, collection? }] }  (max 50)
// Response: { results: [{ key, image: { small, large, id, source } | null }] }
// `key` is "<name>|<set>", echoed back so the client can map results to rows.
router.post('/images', async (req, res) => {
	const cards = Array.isArray(req.body?.cards) ? req.body.cards : null;
	if (!cards) return res.status(400).json({ error: 'cards array is required' });

	// Dedupe by name+set so a card appearing in several tabs is resolved once.
	const byKey = new Map();
	for (const c of cards) {
		const name = typeof c?.name === 'string' ? c.name.trim() : '';
		if (!name) continue;
		const set = typeof c?.set === 'string' ? c.set.trim() : '';
		const key = `${name}|${set}`;
		if (!byKey.has(key)) {
			byKey.set(key, { name, set, collection: typeof c?.collection === 'string' ? c.collection : '' });
		}
		if (byKey.size >= 50) break; // bound upstream fan-out per request
	}

	try {
		const results = await Promise.all(
			[...byKey.entries()].map(async ([key, card]) => ({
				key,
				image: await resolveCardImage(card), // never throws — null on miss
			}))
		);
		res.json({ results });
	} catch (err) {
		logger.warn(`[CATALOG_IMAGES] ${err.message}`);
		res.status(502).json({ error: 'Image resolution failed' });
	}
});

export default router;
