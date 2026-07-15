// CardPop MCP server — a read-only Model Context Protocol endpoint over the
// Streamable HTTP transport (JSON responses). Mounted at /api/mcp.
//
// This is a minimal, dependency-free implementation of the MCP request/response
// flow (JSON-RPC 2.0): initialize, tools/list, tools/call, ping. It exposes the
// read-only tools in src/utils/mcpTools.js and nothing else — no resources,
// prompts, sampling, or server-initiated messages, so there is no need for SSE
// streaming or session state. That keeps it robust on stateless serverless.
//
// It does NOT open an SSE stream on GET; a compliant Streamable HTTP client
// that only needs request/response tool calls works over POST alone. Rate
// limiting is applied by the shared apiLimiter where this router is mounted
// (src/routes/index.js), and Cloudflare fronts it in production.

import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { buildTools } from '../utils/mcpTools.js';
import logger from '../utils/logger.js';

const router = express.Router();

const SERVER_INFO = { name: 'cardpop', version: '1.0.0' };
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const INSTRUCTIONS =
	'Read-only tools for CardPop, an Australian trading card marketplace. ' +
	'Use get_site_overview to orient, search_cards to find buyable listings, and ' +
	'get_card_price for a card’s latest AUD market price.';

const tools = buildTools(supabase);
const toolMap = new Map(tools.map((t) => [t.name, t]));

const result = (id, value) => ({ jsonrpc: '2.0', id, result: value });
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

// Handle one JSON-RPC message. Returns a response object, or null for a
// notification (no id) / message that needs no reply.
async function handleMessage(msg) {
	if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
		return error(msg && msg.id != null ? msg.id : null, -32600, 'Invalid Request');
	}

	const { id, method, params } = msg;
	const isRequest = id !== undefined && id !== null;

	switch (method) {
		case 'initialize': {
			const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : null;
			return result(id, {
				protocolVersion: requested || DEFAULT_PROTOCOL_VERSION,
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions: INSTRUCTIONS,
			});
		}
		case 'ping':
			return result(id, {});
		case 'tools/list':
			return result(id, {
				tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
			});
		case 'tools/call': {
			const tool = toolMap.get(params?.name);
			if (!tool) return error(id, -32602, `Unknown tool: ${params?.name}`);
			try {
				return result(id, await tool.execute(params?.arguments || {}));
			} catch (err) {
				logger.error(`[MCP] tool "${params?.name}" failed: ${err.message}`);
				// Tool execution failures are reported in-band (isError), not as a
				// JSON-RPC protocol error — per the MCP tools spec.
				return result(id, { content: [{ type: 'text', text: `Tool error: ${err.message}` }], isError: true });
			}
		}
		default:
			// Unknown notifications (e.g. notifications/initialized) are ignored.
			if (!isRequest) return null;
			return error(id, -32601, `Method not found: ${method}`);
	}
}

router.post('/', async (req, res) => {
	const body = req.body;

	if (Array.isArray(body)) {
		if (body.length === 0) return res.status(400).json(error(null, -32600, 'Empty batch'));
		const responses = (await Promise.all(body.map(handleMessage))).filter(Boolean);
		if (responses.length === 0) return res.status(202).end();
		return res.json(responses);
	}

	const response = await handleMessage(body);
	if (!response) return res.status(202).end();
	return res.json(response);
});

// This server does not offer a server-to-client SSE stream, and holds no
// session state to terminate, so GET/DELETE are not supported.
const methodNotAllowed = (_req, res) =>
	res.status(405).set('Allow', 'POST').json(error(null, -32000, 'Method not allowed. Use POST (Streamable HTTP, JSON).'));

router.get('/', methodNotAllowed);
router.delete('/', methodNotAllowed);

export default router;
