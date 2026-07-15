import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ──────────────────────────────────────────────────────────────────
const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../src/utils/supabaseClient.js', () => ({ default: mockSupabase, supabase: mockSupabase }));
vi.mock('../../src/utils/logger.js', () => ({
	default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import mcpRouter from '../../src/routes/mcp.js';

function makeApp() {
	const app = express();
	app.use(express.json());
	app.use('/mcp', mcpRouter);
	return app;
}
const app = makeApp();

function makeBuilder(result) {
	const b = {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		neq: vi.fn().mockReturnThis(),
		ilike: vi.fn().mockReturnThis(),
		or: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		maybeSingle: vi.fn().mockResolvedValue(result),
		then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
	};
	return b;
}

// Route Supabase queries per table to a canned result.
function stubTables(map) {
	mockSupabase.from.mockImplementation((table) => makeBuilder(map[table] ?? { data: null, error: null }));
}

const rpc = (body) => request(app).post('/mcp').send(body);

beforeEach(() => vi.clearAllMocks());

describe('MCP server', () => {
	it('initialize echoes the protocol version and advertises tools', async () => {
		const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
		expect(res.status).toBe(200);
		expect(res.body.result.protocolVersion).toBe('2025-03-26');
		expect(res.body.result.serverInfo).toEqual({ name: 'cardpop', version: '1.0.0' });
		expect(res.body.result.capabilities.tools).toBeDefined();
	});

	it('tools/list returns the three read-only tools', async () => {
		const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
		const names = res.body.result.tools.map((t) => t.name);
		expect(names).toEqual(['search_cards', 'get_card_price', 'get_site_overview']);
		for (const t of res.body.result.tools) {
			expect(typeof t.description).toBe('string');
			expect(t.inputSchema.type).toBe('object');
		}
	});

	it('ping returns an empty result', async () => {
		const res = await rpc({ jsonrpc: '2.0', id: 3, method: 'ping' });
		expect(res.body.result).toEqual({});
	});

	it('search_cards returns active listings mapped to price + url', async () => {
		stubTables({
			listings: {
				data: [
					{ id: 'abc', price_aud: 42.5, vault_item: { card_name: 'Charizard' }, seller: { display_name: 'AceCards' } },
				],
				error: null,
			},
		});
		const res = await rpc({
			jsonrpc: '2.0',
			id: 4,
			method: 'tools/call',
			params: { name: 'search_cards', arguments: { query: 'Charizard' } },
		});
		const payload = JSON.parse(res.body.result.content[0].text);
		expect(payload.count).toBe(1);
		expect(payload.results[0]).toMatchObject({
			card_name: 'Charizard',
			price_aud: 42.5,
			seller: 'AceCards',
			url: 'https://cardpop.com.au/marketplace/abc',
		});
		// Verify the query was constrained to public, buyable listings.
		const builder = mockSupabase.from.mock.results[0].value;
		expect(builder.eq).toHaveBeenCalledWith('status', 'active');
		expect(builder.neq).toHaveBeenCalledWith('listing_type', 'vault');
	});

	it('search_cards rejects an empty query without querying', async () => {
		const res = await rpc({
			jsonrpc: '2.0',
			id: 5,
			method: 'tools/call',
			params: { name: 'search_cards', arguments: { query: '   ' } },
		});
		expect(res.body.result.content[0].text).toMatch(/non-empty/i);
		expect(mockSupabase.from).not.toHaveBeenCalled();
	});

	it('get_card_price returns the latest snapshot for a matched card', async () => {
		stubTables({
			tracked_cards: { data: [{ id: 'c1', slug: 'charizard-base', name: 'Charizard', set_name: 'Base Set', category: 'pokemon' }], error: null },
			card_price_snapshots: {
				data: { snapshot_date: '2026-07-13', raw_avg: 300, raw_min: 250, raw_max: 400, raw_count: 12, graded_avg: 900, graded_min: 700, graded_max: 1500, graded_count: 5 },
				error: null,
			},
		});
		const res = await rpc({
			jsonrpc: '2.0',
			id: 6,
			method: 'tools/call',
			params: { name: 'get_card_price', arguments: { query: 'Charizard' } },
		});
		const payload = JSON.parse(res.body.result.content[0].text);
		expect(payload.card).toMatchObject({ name: 'Charizard', set: 'Base Set', url: 'https://cardpop.com.au/prices/charizard-base' });
		expect(payload.price.raw.avg).toBe(300);
		expect(payload.price.graded.avg).toBe(900);
	});

	it('get_card_price reports when no card matches', async () => {
		stubTables({ tracked_cards: { data: [], error: null } });
		const res = await rpc({
			jsonrpc: '2.0',
			id: 7,
			method: 'tools/call',
			params: { name: 'get_card_price', arguments: { query: 'Nonexistent' } },
		});
		expect(res.body.result.content[0].text).toMatch(/no tracked card/i);
	});

	it('unknown tool returns a JSON-RPC error', async () => {
		const res = await rpc({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'delete_everything' } });
		expect(res.body.error.code).toBe(-32602);
	});

	it('unknown method returns method-not-found', async () => {
		const res = await rpc({ jsonrpc: '2.0', id: 9, method: 'resources/list' });
		expect(res.body.error.code).toBe(-32601);
	});

	it('a notification (no id) is accepted with no body', async () => {
		const res = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
		expect(res.status).toBe(202);
		expect(res.text).toBe('');
	});

	it('GET is not allowed (no SSE stream offered)', async () => {
		const res = await request(app).get('/mcp');
		expect(res.status).toBe(405);
		expect(res.headers.allow).toBe('POST');
	});
});
