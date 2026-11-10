/**
 * Sentry initialisation for the backend — the one place `Sentry.init` runs.
 *
 * Imported first by src/app.js (api/index.js, and the VPS server through it)
 * and by the separate long-running functions that don't load the Express app
 * (api/blog-generate.js, api/event-scan.js, api/grade-estimate.js). Before
 * this file those three never initialised Sentry at all, so their errors and
 * their Claude calls — the most expensive ones the site makes — were invisible.
 *
 * ESM evaluates imports before the importing module's body, so this file loads
 * `.env` itself: `dotenv.config()` in app.js runs after it.
 */
import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { aiTracesSampler, AI_RECORD_CONTENT } from './utils/aiTracing.js';

// The cardpop-australia-yr/javascript-react project. SENTRY_DSN overrides it.
export const DEFAULT_SENTRY_DSN = 'https://fe32f5ea5d8c9f4196ec601fae47e046@o4511766283026432.ingest.us.sentry.io/4511767250141184';

// Sentry captures every 5xx via setupExpressErrorHandler in app.js. With the
// default request-data integration that included the JSON body and every
// header — so a throw inside /auth/password/change shipped the user's current
// AND new password, plus their bearer token, to a third party. Bodies, cookies
// and headers are now excluded outright and a final scrub strips anything
// secret-shaped that still reaches an event.
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|otp|code|card|cvc|ssn|api[-_]?key/i;

function scrubRequest(event) {
	if (!event?.request) return;
	delete event.request.data;
	delete event.request.cookies;
	if (event.request.headers) {
		for (const k of Object.keys(event.request.headers)) {
			if (/^(authorization|cookie|x-csrf-token|x-api-key)$/i.test(k)) delete event.request.headers[k];
		}
	}
	if (typeof event.request.query_string === 'string' && /token|code|secret|key/i.test(event.request.query_string)) {
		event.request.query_string = '[Filtered]';
	}
}

export function scrubSentryEvent(event) {
	scrubRequest(event);
	const scrub = (obj, depth = 0) => {
		if (!obj || typeof obj !== 'object' || depth > 6) return;
		for (const k of Object.keys(obj)) {
			if (SENSITIVE_KEY.test(k)) obj[k] = '[Filtered]';
			else scrub(obj[k], depth + 1);
		}
	};
	scrub(event?.extra);
	scrub(event?.contexts);
	if (event?.user) event.user = event.user.id ? { id: event.user.id } : undefined;
	return event;
}

/**
 * Transactions (the agent-tracing spans) get the request scrub and the
 * id-only user, but not the key scrub: span data is `gen_ai.usage.*_tokens`
 * and friends, which the key pattern would blank. What a span carries is
 * decided where it is built (src/utils/aiTracing.js — photos never leave).
 */
export function scrubSentryTransaction(event) {
	scrubRequest(event);
	if (event?.user) event.user = event.user.id ? { id: event.user.id } : undefined;
	return event;
}

if (!Sentry.getClient()) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN || DEFAULT_SENTRY_DSN,
		// Nothing leaves a test run (the suites import app.js and drive the AI routes).
		enabled: !process.env.VITEST,
		// Ordinary request tracing stays off by default (SENTRY_TRACES_SAMPLE_RATE,
		// 0 unless set). ESM hoists imports, so `express` is loaded before this
		// init runs and Sentry's Express auto-instrumentation never attaches —
		// sampled request traces carried no route spans while every request paid
		// the bookkeeping. If request tracing is ever wanted, initialise Sentry
		// through `node --import` so it precedes express. The SDK import itself is
		// ~300 ms of the ~800 ms cold start — see docs/performance.md.
		//
		// Agent tracing is the exception: every Claude call runs inside a root
		// `gen_ai.invoke_agent` span (src/utils/aiTracing.js), which the sampler
		// keeps at SENTRY_AI_TRACES_SAMPLE_RATE (default 1). That is a handful of
		// spans per scan/estimate/nightly job, not per request.
		tracesSampler: aiTracesSampler,
		// Agent tracing records prompts and replies (never photos) so the
		// Conversations view can replay them. SENTRY_AI_RECORD_CONTENT=false
		// keeps tokens, latency and cost only.
		dataCollection: { genAI: { inputs: AI_RECORD_CONTENT, outputs: AI_RECORD_CONTENT } },
		environment: process.env.NODE_ENV || 'production',
		sendDefaultPii: false,
		integrations: (defaults) => [
			// The Anthropic clients are wrapped explicitly where they are built
			// (instrumentAnthropic()), which works whether or not the module hook
			// caught the SDK's dynamic import — so the auto integration would only
			// double every span.
			...defaults.filter((i) => i.name !== 'Anthropic_AI' && i.name !== 'RequestData'),
			Sentry.requestDataIntegration({
				include: { cookies: false, data: false, headers: false, ip: false, query_string: true, url: true, user: false },
			}),
		],
		beforeSend: scrubSentryEvent,
		beforeSendTransaction: scrubSentryTransaction,
	});
}
