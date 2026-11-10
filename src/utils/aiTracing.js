/**
 * Sentry agent tracing for every Claude call the backend makes.
 *
 * Each AI feature runs as one `gen_ai.invoke_agent` span (traceAiAgent) with a
 * `gen_ai.chat` child per model request (traceChat + recordChatResponse), in
 * the shape Sentry's Agents dashboards and Conversations view read: model,
 * token usage (cache reads/writes included), latency, stop reason, errors and
 * — unless SENTRY_AI_RECORD_CONTENT=false — the prompt and the reply.
 *
 * Why manual spans rather than Sentry's Anthropic auto-instrumentation: half
 * the calls are direct HTTP requests to the Messages API (card scans, grade
 * estimates, descriptions), the blog drafter uses `beta.messages.stream`,
 * which the SDK's wrapper does not cover, and the photos sent with a scan or
 * an estimate must never leave for a third party ("photos inline, never
 * stored"). One helper that builds the attributes itself keeps all six
 * features consistent and makes the photo rule enforceable in one place:
 * image and document blocks are recorded as a placeholder, never as data.
 *
 * Conversations: withAiConversation() sets `gen_ai.conversation.id` (and the
 * member, id only) on a forked isolation scope, and Sentry's default
 * ConversationId integration stamps it onto every gen_ai span started inside.
 * Only real application ids are used (a blog topic, an event-scan run, a
 * watched event) — Sentry's guidance is to omit the id rather than derive one
 * from a request. See docs/agent-tracing.md.
 *
 * Every helper is a no-op wrapper when Sentry isn't initialised (tests).
 */
import * as Sentry from '@sentry/node';

const rate = (value, fallback) => {
	if (value === undefined || value === null || value === '') return fallback;
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
};

/** Prompts and replies are recorded unless SENTRY_AI_RECORD_CONTENT=false. */
export const AI_RECORD_CONTENT = process.env.SENTRY_AI_RECORD_CONTENT !== 'false';

/** Share of AI operations traced (default all of them). */
export const AI_TRACES_SAMPLE_RATE = rate(process.env.SENTRY_AI_TRACES_SAMPLE_RATE, 1);

/** Share of ordinary request traces (default none — see src/instrument.js). */
export const BASE_TRACES_SAMPLE_RATE = rate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0);

/** Longest single text part recorded; keeps a transaction well under Sentry's size cap. */
export const MAX_RECORDED_CHARS = 8000;

export const PHOTO_PLACEHOLDER = '[photo not recorded]';

const AGENT_OP = 'gen_ai.invoke_agent';

/**
 * `tracesSampler` for Sentry.init: AI operations at AI_TRACES_SAMPLE_RATE,
 * everything else as before (inherit an upstream decision, else the base rate).
 */
export function aiTracesSampler(ctx = {}) {
	const op = ctx.attributes?.['sentry.op'];
	const isAi = (typeof op === 'string' && op.startsWith('gen_ai.'))
		|| (typeof ctx.name === 'string' && ctx.name.startsWith('invoke_agent '));
	if (isAi) return AI_TRACES_SAMPLE_RATE;
	if (typeof ctx.inheritOrSampleWith === 'function') return ctx.inheritOrSampleWith(BASE_TRACES_SAMPLE_RATE);
	return typeof ctx.parentSampled === 'boolean' ? ctx.parentSampled : BASE_TRACES_SAMPLE_RATE;
}

const clip = (text) => {
	const s = String(text ?? '');
	return s.length > MAX_RECORDED_CHARS
		? `${s.slice(0, MAX_RECORDED_CHARS)}… [${s.length - MAX_RECORDED_CHARS} more characters not recorded]`
		: s;
};

/** One Anthropic content block → one Sentry message part. Photos become a placeholder. */
function toPart(block) {
	if (typeof block === 'string') return { type: 'text', content: clip(block) };
	if (!block || typeof block !== 'object') return null;
	switch (block.type) {
		case 'text':
			return { type: 'text', content: clip(block.text) };
		case 'image':
		case 'document':
			return { type: 'text', content: PHOTO_PLACEHOLDER };
		case 'thinking':
			return block.thinking ? { type: 'reasoning', content: clip(block.thinking) } : null;
		case 'redacted_thinking':
			return null;
		case 'tool_use':
		case 'server_tool_use':
			return { type: 'tool_call', id: block.id, name: block.name, arguments: clip(JSON.stringify(block.input ?? {})) };
		case 'web_search_tool_result': {
			const results = Array.isArray(block.content)
				? block.content.filter((r) => r?.url).map((r) => ({ title: r.title, url: r.url }))
				: block.content;
			return { type: 'tool_call_response', id: block.tool_use_id, result: clip(JSON.stringify(results ?? null)) };
		}
		case 'tool_result':
			return { type: 'tool_call_response', id: block.tool_use_id, result: clip(typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? null)) };
		default:
			return { type: block.type || 'unknown' };
	}
}

const toParts = (content) => (Array.isArray(content) ? content : [content]).map(toPart).filter(Boolean);

/** Anthropic `messages` → Sentry's `{ role, parts }` shape (photos excluded). */
export function toGenAiMessages(messages = []) {
	return (Array.isArray(messages) ? messages : []).map((m) => ({ role: m?.role || 'user', parts: toParts(m?.content) }));
}

/** Anthropic `system` (string or text blocks) → Sentry system instructions. */
export function toSystemInstructions(system) {
	if (!system) return undefined;
	return toParts(system);
}

/**
 * Token attributes. Anthropic's `input_tokens` excludes cache reads/writes;
 * Sentry's `gen_ai.usage.input_tokens` is the total, with the cache counts as
 * subsets of it.
 */
export function usageAttributes(usage) {
	if (!usage || typeof usage !== 'object') return {};
	const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
	const cacheRead = n(usage.cache_read_input_tokens);
	const cacheWrite = n(usage.cache_creation_input_tokens);
	const input = n(usage.input_tokens) + cacheRead + cacheWrite;
	const output = n(usage.output_tokens);
	const attrs = {
		'gen_ai.usage.input_tokens': input,
		'gen_ai.usage.output_tokens': output,
		'gen_ai.usage.total_tokens': input + output,
	};
	if (cacheRead) attrs['gen_ai.usage.cache_read.input_tokens'] = cacheRead;
	if (cacheWrite) attrs['gen_ai.usage.cache_creation.input_tokens'] = cacheWrite;
	const searches = n(usage.server_tool_use?.web_search_requests);
	if (searches) attrs['gen_ai.usage.web_search_requests'] = searches;
	return attrs;
}

/** Attributes describing a request, set when the chat span starts. */
export function chatRequestAttributes({ model, system, messages, maxTokens, stream, tools, recordContent = AI_RECORD_CONTENT }) {
	const attrs = {
		'gen_ai.operation.name': 'chat',
		'gen_ai.provider.name': 'anthropic',
		'gen_ai.system': 'anthropic',
		'gen_ai.request.model': model,
	};
	if (maxTokens) attrs['gen_ai.request.max_tokens'] = maxTokens;
	if (stream) attrs['gen_ai.request.stream'] = true;
	if (Array.isArray(tools) && tools.length) {
		attrs['gen_ai.tool.definitions'] = JSON.stringify(tools.map((t) => ({ name: t.name, type: t.type })));
	}
	if (recordContent) {
		const instructions = toSystemInstructions(system);
		if (instructions?.length) attrs['gen_ai.system_instructions'] = JSON.stringify(instructions);
		attrs['gen_ai.input.messages'] = JSON.stringify(toGenAiMessages(messages));
	}
	return attrs;
}

/** Attributes describing a reply (an Anthropic message, or one assembled from a stream). */
export function chatResponseAttributes(message, { recordContent = AI_RECORD_CONTENT } = {}) {
	if (!message || typeof message !== 'object') return {};
	const attrs = { ...usageAttributes(message.usage) };
	if (message.model) attrs['gen_ai.response.model'] = message.model;
	if (message.id) attrs['gen_ai.response.id'] = message.id;
	if (message.stop_reason) attrs['gen_ai.response.finish_reasons'] = JSON.stringify([message.stop_reason]);
	if (recordContent && message.content != null) {
		attrs['gen_ai.output.messages'] = JSON.stringify([{ role: 'assistant', parts: toParts(message.content) }]);
	}
	return attrs;
}

/** Record a reply on the chat span. Never throws. */
export function recordChatResponse(span, message) {
	try {
		if (span?.isRecording?.()) span.setAttributes(chatResponseAttributes(message));
		if (message?.stop_reason === 'refusal') span?.setAttribute?.('error.type', 'refusal');
	} catch { /* tracing must never fail the call */ }
}

const isSampled = (span) => Boolean(span && (span.spanContext().traceFlags & 1) === 1);

/**
 * Runs `fn` inside a `gen_ai.invoke_agent` span for one AI feature. Nests under
 * a sampled caller span; otherwise starts its own trace, so the unsampled
 * request span a route runs under (request tracing is off) can't drop it.
 *
 * @template T
 * @param {string} agent - human name shown in Sentry, e.g. 'Card identifier'
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function traceAiAgent(agent, fn) {
	const active = Sentry.getActiveSpan();
	const nest = isSampled(active);
	if (nest) return startAgentSpan(agent, nest, fn);
	try {
		return await startAgentSpan(agent, nest, fn);
	} finally {
		// A serverless instance can be frozen as soon as the response ends, which
		// would strand the queued transaction. A few hundred ms against a call
		// that takes seconds; skipped on the long-lived VPS process.
		if (process.env.VERCEL) await Sentry.flush(2000).catch(() => {});
	}
}

function startAgentSpan(agent, nest, fn) {
	return Sentry.startSpan({
		name: `invoke_agent ${agent}`,
		op: AGENT_OP,
		forceTransaction: !nest,
		...(nest ? {} : { parentSpan: null }),
		attributes: {
			'gen_ai.operation.name': 'invoke_agent',
			'gen_ai.agent.name': agent,
			'gen_ai.provider.name': 'anthropic',
			'gen_ai.system': 'anthropic',
		},
	}, () => fn());
}

/**
 * Runs `fn(span)` inside a `gen_ai.chat` span for one model request. Call
 * recordChatResponse(span, message) once the reply is in.
 *
 * @template T
 * @param {{ model: string, system?: any, messages?: any[], maxTokens?: number, stream?: boolean, tools?: any[] }} request
 * @param {(span: import('@sentry/node').Span) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function traceChat(request, fn) {
	let attributes;
	try { attributes = chatRequestAttributes(request); } catch { attributes = { 'gen_ai.operation.name': 'chat', 'gen_ai.request.model': request?.model }; }
	return Sentry.startSpan({
		name: `chat ${request?.model || 'claude'}`,
		op: 'gen_ai.chat',
		attributes,
	}, async (span) => {
		try {
			return await fn(span);
		} catch (err) {
			try {
				span.setAttribute('error.type', /abort|timeout/i.test(String(err?.name) + String(err?.message)) ? 'timeout' : (err?.name || 'Error'));
			} catch { /* ignore */ }
			throw err;
		}
	});
}

/**
 * Groups the AI work done inside `fn` into one Sentry conversation and names
 * the member it was for. Forks the isolation scope so neither leaks into the
 * rest of the request or the next job.
 *
 * @template T
 * @param {{ conversationId?: string|null, userId?: string|null }} ids
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
/**
 * Sets the conversation id for the rest of the current isolation scope — for
 * a job that only learns its id part-way (an event-scan run row). Call it
 * inside withAiConversation() so it can't outlive the job.
 */
export function setAiConversationId(conversationId) {
	if (conversationId) Sentry.setConversationId(String(conversationId));
}

export function withAiConversation({ conversationId = null, userId = null } = {}, fn) {
	return Sentry.withIsolationScope(() => {
		if (conversationId) Sentry.setConversationId(String(conversationId));
		if (userId) Sentry.setUser({ id: String(userId) });
		return fn();
	});
}

/**
 * One SDK `messages.create` call as its own agent run with one chat span:
 * `traceMessagesCreate('Event extractor', params, (p) => client.beta.messages.create(p))`.
 *
 * @template T
 * @param {string} agent
 * @param {object} params - the Messages API request body
 * @param {(params: object) => Promise<T>} create
 * @returns {Promise<T>}
 */
export function traceMessagesCreate(agent, params, create) {
	const request = { model: params?.model, system: params?.system, messages: params?.messages, maxTokens: params?.max_tokens, tools: params?.tools };
	return traceAiAgent(agent, () => traceChat(request, async (span) => {
		const message = await create(params);
		recordChatResponse(span, message);
		return message;
	}));
}
