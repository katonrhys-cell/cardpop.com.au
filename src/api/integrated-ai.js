import process from 'node:process';
import crypto from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import dotenv from 'dotenv';
import { NodeEnv } from '../constants/common.js';
import logger from '../utils/logger.js';
import { supabase } from '../utils/supabaseClient.js';
import { compressImageBuffer } from '../utils/compressImageBuffer.js';

dotenv.config();

const MessageRole = Object.freeze({
	User: 'user',
	Assistant: 'assistant',
	Tool: 'tool',
});

const SSEEventType = Object.freeze({
	Content: 'content',
	Reasoning: 'reasoning',
	ToolUse: 'tool_use',
	ToolResult: 'tool_result',
	Usage: 'usage',
	Error: 'error',
	Done: 'done',
	Completed: 'completed',
});

export const ContentBlockType = Object.freeze({
	Text: 'text',
	Image: 'image',
});

const HistoryEventTypes = new Set([
	SSEEventType.Reasoning,
	SSEEventType.Content,
	SSEEventType.ToolUse,
	SSEEventType.ToolResult,
	SSEEventType.Error,
]);

const SquashableSSEEventTypes = new Set([
	SSEEventType.Content,
	SSEEventType.Reasoning,
	SSEEventType.Error,
]);

/**
 * @typedef {typeof SSEEventType[keyof typeof SSEEventType]} SSEEventTypeValue
 */

/**
 * @typedef {object} SSEEventContent
 * @property {'content'} type
 * @property {{ content: string }} data
 * @property {{ agentName?: string }} [metadata]
 */

/**
 * @typedef {object} SSEEventToolUse
 * @property {'tool_use'} type
 * @property {{ toolId: string, toolName: string, inputParams: Record<string, any> }} data
 * @property {{ agentName?: string }} [metadata]
 */

/**
 * @typedef {object} SSEEventToolResult
 * @property {'tool_result'} type
 * @property {{ toolCallId: string, content: string }} data
 * @property {{ agentName?: string }} [metadata]
 */

/**
 * @typedef {object} GenerateImageInput
 * @property {string} prompt
 * @property {string} image_size
 */

/**
 * @typedef {object} GenerateImageToolCall
 * @property {string} id
 * @property {'generate_image'} name
 * @property {GenerateImageInput} input
 * @property {string} [thought_signature]
 */

/**
 * @typedef {object} SSEEventToolUseGenerateImage
 * @property {'tool_use'} type
 * @property {{ role: string, agent_name: string, content: string, tool_calls: GenerateImageToolCall[] }} data
 * @property {{ agent_name: string }} [metadata]
 */

/**
 * @typedef {object} SSEEventToolResultGenerateImage
 * @property {'tool_result'} type
 * @property {{ tool_call_id: string, tool_name: 'generate_image', agent_name: string, content: string }} data
 * @property {{ agent_name: string }} [metadata]
 */

/**
 * @typedef {object} SSEEventUsage
 * @property {'usage'} type
 * @property {{ promptTokens: number, completionTokens: number, reasoningTokens: number, cacheCreationInputTokens: number, cacheReadInputTokens: number, cachedPromptTokens: number, model: string, provider: string, platform: string, agent: string }} data
 */

/**
 * @typedef {object} SSEEventError
 * @property {'error'} type
 * @property {{ content: string }} data
 */

/**
 * @typedef {object} SSEEventDone
 * @property {'done'} type
 * @property {{ content: string }} data
 */

/**
 * @typedef {SSEEventContent | SSEEventToolUse | SSEEventToolResult | SSEEventUsage | SSEEventError | SSEEventDone} SSEEvent
 */

/**
 * @typedef {SSEEventContent | SSEEventToolUse | SSEEventToolResult} SSEEventHistory
 */

/**
 * @typedef {object} TextContentBlock
 * @property {string} text
 * @property {'text'} type
 */

/**
 * @typedef {object} ImageContentBlock
 * @property {string} image
 * @property {'image'} type
 */

/**
 * @typedef {TextContentBlock | ImageContentBlock} ContentBlock
 */

/**
 * @typedef {object} HistoryMessage
 * @property {string} role
 * @property {string} content
 * @property {string[]} [images]
 * @property {Array<{ id: string, type: string, function: { name: string, arguments: string } }>} [tool_calls]
 * @property {string} [tool_call_id]
 * @property {string} [agent_name]
 */

/**
 * Uploads images to Supabase Storage and returns their public URLs.
 *
 * @param {{ images: Express.Multer.File[] }} params
 * @returns {Promise<string[]>}
 */
export async function uploadImagesToSupabase({ images }) {
	const uploadPromises = images.map(async (file) => {
		// Use the magic-byte-detected extension (set by the file-upload
		// middleware), never the client-supplied originalname — a filename with
		// no '.' (e.g. "x/../../evil") makes originalname.split('.').pop()
		// return the whole string, injecting extra path segments into the key.
		const ext = file.detectedExt || 'jpg';
		const path = `ocr/${crypto.randomBytes(8).toString('hex')}.${ext}`;

		const { buffer, contentType } = await compressImageBuffer(file.buffer, file.mimetype);

		const { error } = await supabase.storage.from('ai-images').upload(path, buffer, {
			contentType,
			upsert: true,
		});
		if (error) throw new Error(`Image upload failed: ${error.message}`);

		const { data } = supabase.storage.from('ai-images').getPublicUrl(path);
		return data.publicUrl;
	});

	return Promise.all(uploadPromises);
}

const PRIVATE_DOCS_BUCKET = 'verification-docs';

/**
 * Uploads a sensitive image (e.g. a government ID scan) to the PRIVATE
 * verification-docs bucket and returns a short-lived signed URL for the AI
 * proxy to fetch, plus the storage path so the caller can delete the object
 * once processing finishes. Never use the public ai-images bucket for
 * identity documents — public objects are world-readable forever.
 *
 * @param {{ image: Express.Multer.File, pathPrefix: string, ttlSeconds?: number }} params
 * @returns {Promise<{ signedUrl: string, path: string }>}
 */
export async function uploadPrivateImage({ image, pathPrefix, ttlSeconds = 600 }) {
	const ext = image.detectedExt || 'jpg';
	const path = `${pathPrefix}/${crypto.randomBytes(8).toString('hex')}.${ext}`;

	const { buffer, contentType } = await compressImageBuffer(image.buffer, image.mimetype);

	const { error } = await supabase.storage.from(PRIVATE_DOCS_BUCKET).upload(path, buffer, {
		contentType,
		upsert: false,
	});
	if (error) throw new Error(`Private image upload failed: ${error.message}`);

	const { data, error: signErr } = await supabase.storage
		.from(PRIVATE_DOCS_BUCKET)
		.createSignedUrl(path, ttlSeconds);
	if (signErr || !data?.signedUrl) {
		// Don't leave an orphaned document behind if we can't produce a URL.
		await deletePrivateImage(path);
		throw new Error(`Could not sign private image URL: ${signErr?.message || 'no URL returned'}`);
	}

	return { signedUrl: data.signedUrl, path };
}

/** Best-effort removal of a private document once processing is done. */
export async function deletePrivateImage(path) {
	if (!path) return;
	const { error } = await supabase.storage.from(PRIVATE_DOCS_BUCKET).remove([path]);
	if (error) {
		logger.error(`Failed to delete private image ${path}: ${error.message} — remove it manually`);
	}
}

/**
 * One-shot AI call without conversation history or persistence.
 * Intended for structured extraction tasks like card OCR.
 *
 * @param {{ systemPrompt: string, userMessage: ContentBlock[] }} params
 * @returns {Promise<import('node:stream').Readable>}
 */
export async function streamOneShot({ systemPrompt, userMessage }) {
	const response = await fetch(`${process.env.INTEGRATED_AI_API_URL}/generate`, {
		method: 'POST',
		headers: {
			'Accept': 'text/event-stream',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${process.env.INTEGRATED_AI_API_KEY}`,
			...(process.env.PROXY_ENTRANCE_ID && { 'X-Proxy-Entrance-Id': process.env.PROXY_ENTRANCE_ID }),
		},
		body: JSON.stringify({
			website_id: process.env.WEBSITE_ID,
			history: [mapUserMessage({ message: userMessage })],
			system_prompt: systemPrompt,
			stream: true,
			environment: process.env.NODE_ENV === NodeEnv.Production ? 'prod' : 'dev',
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unknown error');
		throw new Error(`AI proxy request failed with status ${response.status}: ${errorBody}`);
	}

	const passThrough = new PassThrough();
	const readable = Readable.fromWeb(response.body);

	readable.pipe(passThrough, { end: false });
	readable.on('end', () => {
		passThrough.end(`data: ${JSON.stringify({ type: SSEEventType.Completed, data: { content: '[COMPLETED]' } })}\n\n`);
	});
	readable.on('error', (err) => {
		passThrough.push(`data: ${JSON.stringify({ type: SSEEventType.Error, data: { content: err.message } })}\n\n`);
		passThrough.end();
	});

	return passThrough;
}

/**
 * Sends a message to the AI proxy and pipes SSE events to the client.
 * Assistant message is saved to the conversation history when the stream ends.
 * This method should be used for text/text, image/text, image/image, text/image combinations.
 *
 * @param {{ userId: string, systemPrompt: string, userMessage: ContentBlock[] }} params
 * @returns {Promise<import('node:stream').Readable>}
 */
export async function stream({ userId, systemPrompt, userMessage }) {
	const history = await getHistory({ userId });

	const response = await fetch(`${process.env.INTEGRATED_AI_API_URL}/generate`, {
		method: 'POST',
		headers: {
			'Accept': 'text/event-stream',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${process.env.INTEGRATED_AI_API_KEY}`,
			...(process.env.PROXY_ENTRANCE_ID && { 'X-Proxy-Entrance-Id': process.env.PROXY_ENTRANCE_ID }),
		},
		body: JSON.stringify({
			website_id: process.env.WEBSITE_ID,
			history: [
				...history,
				mapUserMessage({ message: userMessage }),
			],
			system_prompt: systemPrompt,
			stream: true,
			environment: process.env.NODE_ENV === NodeEnv.Production ? 'prod' : 'dev',
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unknown error');
		throw new Error(`AI proxy request failed with status ${response.status}: ${errorBody}`);
	}

	const [clientStream, historyStream] = response.body.tee();
	const passThrough = new PassThrough();

	Readable.fromWeb(clientStream).pipe(passThrough, { end: false });

	processStream({ userId, stream: historyStream, userMessage }).catch((error) => {
		logger.error('Failed to process stream', error);
		passThrough.push(`data: ${JSON.stringify({ type: SSEEventType.Error, data: { content: error.message } })}\n\n`);
	}).finally(() => {
		passThrough.end(`data: ${JSON.stringify({ type: SSEEventType.Completed, data: { content: '[COMPLETED]' } })}\n\n`);
	});

	return passThrough;
}

/**
 * Consumes an SSE stream branch, parses history-relevant events,
 * and saves the assistant message to the conversation history.
 *
 * @param {{ userId: string, stream: ReadableStream, userMessage: ContentBlock[] }} params
 * @returns {Promise<void>}
 */
async function processStream({ userId, stream, userMessage }) {
	const events = await parseSSEEvents({ stream });
	const historyEvents = events.filter(event => HistoryEventTypes.has(event.type));
	const squashedHistoryEvents = squashSSEEvents({ events: historyEvents });

	await saveMessages({ userId, messages: [
		{
			role: MessageRole.User,
			content: userMessage,
		},
		{
			role: MessageRole.Assistant,
			content: squashedHistoryEvents,
		},
	] });
}

/**
 * Parses SSE events from a ReadableStream.
 *
 * @param {{ stream: ReadableStream }} params
 * @returns {Promise<SSEEvent[]>}
 */
async function parseSSEEvents({ stream }) {
	/** @type {SSEEvent[]} */
	const events = [];
	let buffer = '';

	const textStream = stream.pipeThrough(new TextDecoderStream());

	for await (const chunk of textStream) {
		buffer += chunk;
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (!line.startsWith('data: ')) {
				continue;
			}

			const jsonStr = line.slice(6);

			if (jsonStr === '[DONE]') {
				return events;
			}

			/** @type {SSEEvent} */
			const event = JSON.parse(jsonStr);

			if (event.type === SSEEventType.Error) {
				throw new Error(event.data.content);
			}

			events.push(event);
		}
	}

	return events;
}

/**
 * @param {{ userId: string, messages: { role: typeof MessageRole[keyof typeof MessageRole], content: string }[] }} params
 * @returns {Promise<void>}
 */
async function saveMessages({ userId, messages }) {
	try {
		await supabase.from('ai_messages').insert(
			messages.map(message => ({
				...(userId && { user_id: userId }),
				role: message.role,
				content: JSON.stringify(message.content),
			}))
		);
	} catch (err) {
		logger.error('Failed to save AI messages:', err);
	}
}

/**
 * Fetches message history and maps it to HistoryMessage format.
 *
 * @param {{ userId: string }} params
 * @returns {Promise<HistoryMessage[]>}
 */
export async function getHistory({ userId }) {
	if (!userId) {
		return [];
	}

	try {
		const { data, error } = await supabase.from('ai_messages')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: true });

		if (error || !data) return [];

		/** @type {HistoryMessage[]} */
		const historyMessages = [];

		for (const record of data) {
			const content = typeof record.content === 'string' ? JSON.parse(record.content) : record.content;
			if (record.role === MessageRole.User) {
				historyMessages.push(mapUserMessage({ message: content }));
				continue;
			}
			historyMessages.push(...mapAssistantMessages({ message: content }));
		}

		return historyMessages;
	} catch {
		return [];
	}
}

/**
 * @param {{ message: ContentBlock[] }} params
 * @returns {HistoryMessage}
 */
function mapUserMessage({ message }) {
	const textParts = message.filter(b => b.type === ContentBlockType.Text).map(b => b.text);
	const images = message.filter(b => b.type === ContentBlockType.Image).map(b => b.image);

	return {
		role: MessageRole.User,
		content: textParts.join('\n'),
		...(images.length > 0 && { images }),
	};
}

/**
 * @param {{ message: SSEEventHistory[] }} params
 * @returns {HistoryMessage[]}
 */
function mapAssistantMessages({ message }) {
	/** @type {HistoryMessage[]} */
	const messages = [];

	for (const event of message) {
		const agentName = event?.metadata?.agent_name;

		if (event.type === SSEEventType.ToolResult) {
			messages.push({
				role: MessageRole.Tool,
				tool_call_id: event.data.tool_call_id,
				content: event.data.content,
				...(agentName && { agent_name: agentName }),
			});
			continue;
		}

		messages.push({
			role: MessageRole.Assistant,
			content: event.data.content,
			...(event.type === SSEEventType.ToolUse && {
				tool_calls: event.data.tool_calls.map(toolCall => ({
					id: toolCall.id,
					type: 'function',
					function: {
						name: toolCall.name,
						arguments: JSON.stringify(toolCall.input),
					},
				})),
			}),
			...(agentName && { agent_name: agentName }),
		});
	}

	return messages;
}

function squashSSEEvents({ events }) {
	if (!events.length) {
		return events;
	}

	/** @type {SSEEventHistory[]} */
	const squashedEvents = [];
	let [currentEvent, ...restEvents] = events;

	restEvents.forEach((event) => {
		if (!SquashableSSEEventTypes.has(currentEvent.type) || !SquashableSSEEventTypes.has(event.type) || event.type !== currentEvent.type) {
			squashedEvents.push(currentEvent);
			currentEvent = event;
			return;
		}

		currentEvent = {
			...currentEvent,
			data: {
				...currentEvent.data,
				content: `${currentEvent.data.content}${event.data.content}`,
			},
		};
	});

	squashedEvents.push(currentEvent);

	return squashedEvents;
}
